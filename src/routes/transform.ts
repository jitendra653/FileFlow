import express from 'express';
import { body, query, param, validationResult } from 'express-validator';
import { requireAuth, AuthRequest } from '../middleware/auth';
import FileModel from '../models/file';
import TransformationModel, { ITransformation } from '../models/transformation';
import sharp from 'sharp';
import path from 'path';
import fs from 'fs/promises';
import logger from '../utils/logger';
import { FilterQuery } from 'mongoose';
import rateLimit from 'express-rate-limit';
import { emitToUser, emitToAdmin, fileEvents } from '../utils/socketEvents';
import { processStatus } from '../utils/processStatus';

const router = express.Router();

// Rate limiter for transformations
const transformRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // Limit each IP to 50 requests per windowMs
  message: { error: 'Too many transformation requests, please try again later.' }
});

// Helper function to create transformation record
async function createTransformationRecord(
  fileId: string,
  userId: number,
  originalPath: string,
  type: string,
  parameters: Record<string, any>
) {
  const file = await FileModel.findById(fileId);
  if (!file) throw new Error('File not found');

  return await TransformationModel.create({
    fileId,
    userId,
    originalPath,
    type,
    parameters,
    metadata: {
      originalSize: file.size,
      originalFormat: path.extname(file.originalName).slice(1)
    }
  });
}

// Helper function to update transformation status
async function updateTransformationStatus(
  transformationId: string,
  status: 'processing' | 'completed' | 'failed',
  updates: Partial<ITransformation> = {}
) {
  return await TransformationModel.findByIdAndUpdate(
    transformationId,
    { $set: { status, ...updates } },
    { new: true }
  );
}

// Basic transform endpoint (legacy support)
router.get('/',
  transformRateLimit,
  requireAuth,
  [
    query('fileId').optional().isString().withMessage('Invalid fileId'),
    query('path').optional().isString().withMessage('Invalid path'),
    query('width').optional().isInt({ min: 1, max: 10000 }).withMessage('Invalid width'),
    query('height').optional().isInt({ min: 1, max: 10000 }).withMessage('Invalid height'),
    query('format').optional().isIn(['jpeg', 'png', 'webp', 'avif']).withMessage('Invalid format')
  ],
  async (req: AuthRequest, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { fileId, path: filePath, width, height, format } = req.query as any;
      const userId = req.user?.id || req.user?._id;

      let inputPath = '';
      if (fileId) {
        const file = await FileModel.findById(fileId);
        if (!file) return res.status(404).json({ error: 'File not found' });

        if (String(file.userId) !== String(userId)) {
          return res.status(403).json({ error: 'Unauthorized' });
        }

        file.transformations = (file.transformations || 0) + 1;
        await file.save();

        inputPath = file.path;

        // Create transformation record
        const transformation = await createTransformationRecord(
          fileId,
          userId,
          inputPath,
          'basic',
          { width, height, format }
        );

      await updateTransformationStatus(transformation._id, 'processing');

      const processId = `transform-${transformation._id}`;
      processStatus.startProcess(processId, {
        fileId,
        userId: String(userId),
        type: 'transform',
        progress: 0,
        status: 'processing',
        message: 'Starting transformation',
        details: {
          transformationId: transformation._id
        }
      });

      try {
        const startTime = Date.now();
        const transformer = sharp(inputPath);          if (width || height) {
            transformer.resize(
              width ? parseInt(width) : null,
              height ? parseInt(height) : null
            );
          }
          
          if (format && ['jpeg', 'png', 'webp', 'avif'].includes(String(format))) {
            transformer.toFormat(format);
          }

          const buffer = await transformer.toBuffer();
          const metadata = await sharp(buffer).metadata();
          const outputFormat = format || metadata.format;

          // Save transformed file
          const transformedPath = inputPath.replace(path.extname(inputPath), `-transformed-${Date.now()}.${outputFormat}`);
          await fs.writeFile(transformedPath, buffer);
          const transformedStats = await fs.stat(transformedPath);

          // Update transformation record
          const updatedTransformation = await updateTransformationStatus(
            transformation._id,
            'completed',
            {
              transformedPath,
              metadata: {
                ...transformation.metadata,
                transformedSize: transformedStats.size,
                transformedFormat: outputFormat,
                duration: Date.now() - startTime
              }
            }
          );

          // Update process status to completed
          processStatus.updateStatus(processId, {
            status: 'completed',
            progress: 100,
            message: 'Transformation completed successfully',
            details: {
              transformationId: transformation._id,
              transformation: updatedTransformation
            }
          });

          res.type(outputFormat || 'application/octet-stream');
          res.send(buffer);
        } catch (error) {
          const failedTransformation = await updateTransformationStatus(
            transformation._id,
            'failed',
            { error: (error as Error).message }
          );

          // Update process status to failed
          processStatus.updateStatus(processId, {
            status: 'failed',
            progress: 0,
            message: 'Transformation failed',
            error: (error as Error).message,
            details: {
              transformationId: transformation._id,
              transformation: failedTransformation
            }
          });

          throw error;
        }
      } else {
        return res.status(400).json({ error: 'fileId required' });
      }
    } catch (error) {
      logger.error('Transform error', { error });
      res.status(500).json({ error: 'Transform failed' });
    }
  }
);

// Get transformation history for a file
router.get('/history/:fileId',
  requireAuth,
  [
    param('fileId').isString().withMessage('Invalid fileId'),
    query('page').optional().isInt({ min: 1 }).withMessage('Invalid page'),
    query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Invalid limit')
  ],
  async (req: AuthRequest, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const userId = req.user?.id || req.user?._id;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const skip = (page - 1) * limit;

      const file = await FileModel.findOne({ _id: req.params.fileId, userId });
      if (!file) {
        return res.status(404).json({ error: 'File not found' });
      }

      const transformations = await TransformationModel
        .find({ fileId: file._id })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);

      const total = await TransformationModel.countDocuments({ fileId: file._id });

      res.json({
        transformations,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(total / limit),
          totalItems: total
        }
      });
    } catch (error) {
      logger.error('Error fetching transformation history', { error });
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// Advanced image transformation
router.post('/image',
  transformRateLimit,
  requireAuth,
  [
    body('fileId').isString().withMessage('fileId is required'),
    body('operations').isArray().withMessage('operations is required'),
    body('operations.*.type').isIn(['resize', 'rotate', 'flip', 'flop', 'grayscale', 'blur']).withMessage('Invalid operation type'),
    body('operations.*.params').isObject().withMessage('Operation parameters are required')
  ],
  async (req: AuthRequest, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { fileId, operations } = req.body;
      const userId = req.user?.id || req.user?._id;

      const file = await FileModel.findOne({ _id: fileId, userId });
      if (!file) {
        return res.status(404).json({ error: 'File not found' });
      }

      // Create transformation record
      const transformation = await createTransformationRecord(
        fileId,
        userId,
        file.path,
        'advanced',
        { operations }
      );

      try {
        await updateTransformationStatus(transformation._id, 'processing');

        let image = sharp(file.path);
        const startTime = Date.now();

        // Apply operations
        for (const op of operations) {
          switch (op.type) {
            case 'resize':
              image = image.resize(op.params.width, op.params.height, {
                fit: op.params.fit || 'cover'
              });
              break;
            case 'rotate':
              image = image.rotate(op.params.angle);
              break;
            case 'flip':
              image = image.flip();
              break;
            case 'flop':
              image = image.flop();
              break;
            case 'grayscale':
              image = image.grayscale();
              break;
            case 'blur':
              image = image.blur(op.params.sigma);
              break;
          }
        }

        // Save transformed image
        const ext = path.extname(file.path);
        const transformedPath = file.path.replace(ext, `-transformed-${Date.now()}${ext}`);
        await image.toFile(transformedPath);

        const transformedStats = await fs.stat(transformedPath);
        const duration = Date.now() - startTime;

        // Update transformation record
        const updatedTransformation = await updateTransformationStatus(
          transformation._id,
          'completed',
          {
            transformedPath,
            metadata: {
              ...transformation.metadata,
              transformedSize: transformedStats.size,
              transformedFormat: path.extname(transformedPath).slice(1),
              duration
            }
          }
        );

        res.json(updatedTransformation);
      } catch (error) {
        await updateTransformationStatus(
          transformation._id,
          'failed',
          { error: (error as Error).message }
        );
        throw error;
      }
    } catch (error) {
      logger.error('Error transforming image', { error });
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// Check transformation status
router.get('/status/:transformationId',
  requireAuth,
  [
    param('transformationId').isString().withMessage('Invalid transformationId')
  ],
  async (req: AuthRequest, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const transformation = await TransformationModel.findById(req.params.transformationId);
      if (!transformation) {
        return res.status(404).json({ error: 'Transformation not found' });
      }

      res.json(transformation);
    } catch (error) {
      logger.error('Error checking transformation status', { error });
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// Get user's transformation statistics
router.get('/stats',
  requireAuth,
  async (req: AuthRequest, res) => {
    try {
      const userId = req.user?.id || req.user?._id;

      const stats = await Promise.all([
        TransformationModel.countDocuments({ userId }),
        TransformationModel.countDocuments({ userId, status: 'completed' }),
        TransformationModel.countDocuments({ userId, status: 'failed' }),
        TransformationModel.aggregate([
          { $match: { userId } },
          { $group: {
            _id: null,
            totalOriginalSize: { $sum: '$metadata.originalSize' },
            totalTransformedSize: { $sum: '$metadata.transformedSize' },
            averageDuration: { $avg: '$metadata.duration' }
          }}
        ])
      ]);

      const [total, completed, failed, metrics] = stats;

      res.json({
        total,
        completed,
        failed,
        pending: total - completed - failed,
        metrics: metrics[0] || {
          totalOriginalSize: 0,
          totalTransformedSize: 0,
          averageDuration: 0
        }
      });
    } catch (error) {
      logger.error('Error fetching transformation stats', { error });
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

export default router;
