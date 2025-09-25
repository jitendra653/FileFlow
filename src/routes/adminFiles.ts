import express from 'express';
import { body, query, validationResult } from 'express-validator';
import { requireAdmin, requireSuperAdmin } from '../middleware/adminAuth';
import { AuthRequest } from '../middleware/auth';
import FileModel from '../models/file';
import UserModel from '../models/user';
import logger from '../utils/logger';
import { FilterQuery } from 'mongoose';
import fs from 'fs/promises';
import path from 'path';

const router = express.Router();

// Get all files with pagination and filters
router.get('/files',
  requireAdmin,
  [
    query('page').optional().isInt({ min: 1 }).withMessage('page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('limit must be between 1 and 100'),
    query('userId').optional().isString().withMessage('userId must be a string'),
    query('category').optional().isString().withMessage('category must be a string'),
    query('sortBy').optional().isIn(['createdAt', 'size', 'downloads', 'originalName']).withMessage('Invalid sortBy field'),
    query('order').optional().isIn(['asc', 'desc']).withMessage('Invalid order'),
    query('search').optional().isString().withMessage('search must be a string')
  ],
  async (req: AuthRequest, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const skip = (page - 1) * limit;

      // Build query
      const query: FilterQuery<typeof FileModel> = {};
      if (req.query.userId) query.userId = req.query.userId;
      if (req.query.category) query.category = req.query.category;
      if (req.query.search) {
        query.originalName = { $regex: req.query.search, $options: 'i' };
      }

      // Build sort options
      const sortBy = req.query.sortBy as string || 'createdAt';
      const order = req.query.order === 'asc' ? 1 : -1;
      const sort: { [key: string]: number } = { [sortBy]: order };

      const files = await FileModel
        .find(query)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .populate('userId', 'email');

      const total = await FileModel.countDocuments(query);

      logger.info(`Retrieved ${files.length} files by admin: ${req.user?.id}`);

      res.json({
        files,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(total / limit),
          totalFiles: total,
          hasNext: skip + files.length < total,
          hasPrevious: page > 1
        }
      });
    } catch (error) {
      logger.error('Error fetching files', { error });
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// Get file details
router.get('/files/:fileId',
  requireAdmin,
  async (req: AuthRequest, res) => {
    try {
      const file = await FileModel.findById(req.params.fileId)
        .populate('userId', 'email');

      if (!file) {
        return res.status(404).json({ error: 'File not found' });
      }

      res.json(file);
    } catch (error) {
      logger.error('Error fetching file details', { error });
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// Update file metadata
router.patch('/files/:fileId',
  requireAdmin,
  [
    body('category').optional().isString().withMessage('category must be a string'),
    body('originalName').optional().isString().withMessage('originalName must be a string')
  ],
  async (req: AuthRequest, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const file = await FileModel.findById(req.params.fileId);
      if (!file) {
        return res.status(404).json({ error: 'File not found' });
      }

      const updateFields: any = {};
      if (req.body.category) updateFields.category = req.body.category;
      if (req.body.originalName) updateFields.originalName = req.body.originalName;

      const updatedFile = await FileModel.findByIdAndUpdate(
        req.params.fileId,
        { $set: updateFields },
        { new: true }
      );

      logger.info(`Updated file metadata: ${file.id} by admin: ${req.user?.id}`);
      res.json(updatedFile);
    } catch (error) {
      logger.error('Error updating file metadata', { error });
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// Delete file
router.delete('/files/:fileId',
  requireAdmin,
  async (req: AuthRequest, res) => {
    try {
      const file = await FileModel.findById(req.params.fileId);
      if (!file) {
        return res.status(404).json({ error: 'File not found' });
      }

      // Delete file from storage
      try {
        await fs.unlink(file.path);
      } catch (error) {
        logger.error('Error deleting file from storage', { error, path: file.path });
      }

      // Delete file record
      await file.delete();

      logger.info(`Deleted file: ${file.id} by admin: ${req.user?.id}`);
      res.json({ message: 'File deleted successfully' });
    } catch (error) {
      logger.error('Error deleting file', { error });
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// Bulk delete files
router.post('/files/bulk-delete',
  requireSuperAdmin,
  [
    body('fileIds').isArray().withMessage('fileIds must be an array'),
    body('fileIds.*').isString().withMessage('Each fileId must be a string')
  ],
  async (req: AuthRequest, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { fileIds } = req.body;
      const files = await FileModel.find({ _id: { $in: fileIds } });

      const results = {
        success: 0,
        failed: 0,
        errors: [] as string[]
      };

      for (const file of files) {
        try {
          await fs.unlink(file.path);
          await file.delete();
          results.success++;
        } catch (error) {
          results.failed++;
          results.errors.push(`File ${file.id}: ${(error as Error).message}`);
          logger.error(`Error deleting file in bulk operation`, { error, fileId: file.id });
        }
      }

      logger.info(`Bulk deleted files by admin: ${req.user?.id}`, results);
      res.json(results);
    } catch (error) {
      logger.error('Error in bulk delete operation', { error });
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// Get file statistics
router.get('/files/stats/overview',
  requireAdmin,
  async (req: AuthRequest, res) => {
    try {
      const stats = await Promise.all([
        FileModel.countDocuments(),
        FileModel.aggregate([
          { $group: {
            _id: null,
            totalSize: { $sum: '$size' },
            totalDownloads: { $sum: '$downloads' }
          }}
        ]),
        FileModel.aggregate([
          { $group: {
            _id: '$category',
            count: { $sum: 1 },
            totalSize: { $sum: '$size' }
          }}
        ]),
        FileModel.aggregate([
          { $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            count: { $sum: 1 }
          }},
          { $sort: { _id: -1 } },
          { $limit: 30 }
        ])
      ]);

      const [totalFiles, metrics, categoryStats, dailyUploads] = stats;

      res.json({
        overview: {
          totalFiles,
          totalSize: metrics[0]?.totalSize || 0,
          totalDownloads: metrics[0]?.totalDownloads || 0
        },
        categoryBreakdown: categoryStats,
        dailyUploads
      });
    } catch (error) {
      logger.error('Error fetching file statistics', { error });
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

export default router;