import express from 'express';
import path from 'path';
import { verifyFileToken, signFileToken, createDownloadUrl, createPreviewUrl } from '../utils/fileToken';
import jwt from 'jsonwebtoken';
import { requireAuth, AuthRequest } from '../middleware/auth';
import FileModel from '../models/file';
import UserModel from '../models/user';
import rateLimit from 'express-rate-limit';
import logger from '../utils/logger';
import { body, query, validationResult } from 'express-validator';
import { FilterQuery, SortOrder } from 'mongoose';

const generateFileUrls = (file: any) => {
  const downloadToken = signFileToken({ path: file.path, purpose: 'download' }, '24h');
  const previewToken = signFileToken({ path: file.path, purpose: 'preview' }, '24h');
  return {
    downloadUrl: createDownloadUrl(downloadToken),
    previewUrl: createPreviewUrl(previewToken)
  };
};

const router = express.Router();

router.get('/user-files',requireAuth, [
  query('category').optional().isString().withMessage('category must be a string'),
  query('sortBy').optional().isIn(['createdAt', 'size', 'downloads']).withMessage('sortBy must be one of: createdAt, size, downloads'),
  query('order').optional().isIn(['asc', 'desc']).withMessage('order must be either asc or desc'),
  query('page').optional().isInt({ min: 1 }).withMessage('page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('limit must be between 1 and 100')
], async (req: AuthRequest, res) => {
  try {

    const userId = req.user?.id || req.user?._id;
    const user = await UserModel.findById(userId);
    if (!user) {
      return res.status(400).json({ errors: { msg: 'User not found' } });
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: { msg: 'Validation failed', details: errors.array() } });
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    // Build query
    const query: FilterQuery<typeof FileModel> = { userId: user?.userId };
    if (req.query.category) {
      query.category = req.query.category;
    }

    // Build sort options
    const sortBy = (req.query.sortBy as string) || 'createdAt';
    const order: SortOrder = (req.query.order as string) === 'asc' ? 'asc' : 'desc';
    const sort: { [key: string]: SortOrder } = {};
    sort[sortBy] = order;

    // Execute query
    const files = await FileModel
      .find(query)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .select('-__v');

    // Add download URLs to each file
    const filesWithUrls = files.map(file => {
      const fileObj = file.toObject();
      const urls = generateFileUrls(file);
      return {
        ...fileObj,
        ...urls
      };
    });

    // Get total count for pagination
    const total = await FileModel.countDocuments(query);

    logger.info(`Retrieved ${files.length} files for user: ${req.user?.id || req.user?._id}`);

    res.json({
      files: filesWithUrls,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalFiles: total,
        hasNext: skip + files.length < total,
        hasPrevious: page > 1
      }
    });
  } catch (error) {
    console.log({error});
    logger.error('Error fetching user files', { error, userId: req.user?.id || req.user?._id });
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/preview', async (req, res) => {
  const token = (req.query.token as string) || '';
  if (!token) return res.status(400).json({ error: 'Missing token' });
  try {
    const payload: any = verifyFileToken(token);
    if (payload.purpose !== 'preview') {
      return res.status(400).json({ error: 'Invalid token purpose' });
    }

    const filePath = payload.path as string;
    if (!filePath) return res.status(400).json({ error: 'Invalid token payload' });

    const file = await FileModel.findOne({ path: filePath });
    if (!file) return res.status(404).json({ error: 'File not found' });

    const abs = path.resolve(filePath);

    // Set content disposition to inline for preview
    res.setHeader('Content-Disposition', `inline; filename="${file.originalName}"`);
    if (file.mimeType) {
      res.setHeader('Content-Type', file.mimeType);
    }

    return res.sendFile(abs);
  } catch (err) {
    return res.status(400).json({ error: 'Invalid or expired token' });
  }
});


router.get('/download', async (req, res) => {
  const token = (req.query.token as string) || '';
  if (!token) return res.status(400).json({ error: 'Missing token' });
  try {
    const payload: any = verifyFileToken(token);
    const filePath = payload.path as string;
    if (!filePath) return res.status(400).json({ error: 'Invalid token payload' });

    const file = await FileModel.findOne({ path: filePath });
    if (!file) return res.status(404).json({ error: 'File not found' });

    file.downloads += 1;
    await file.save();

    const abs = path.resolve(filePath);
    return res.sendFile(abs);
  } catch (err) {
    return res.status(400).json({ error: 'Invalid or expired token' });
  }
});

// Rate limiter for /files/generate-token
const generateTokenRateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // Limit each IP to 10 requests per `window` (here, per minute)
  message: { error: 'Too many requests, please try again later.' },
});


router.post(
  '/generate-token',
  generateTokenRateLimiter,
  requireAuth,
  [
    body('fileId').notEmpty().withMessage('fileId is required'),
    body('expiresIn').optional().isString().withMessage('expiresIn must be a string'),
  ],
  (req: AuthRequest, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      logger.warn('Validation failed for /generate-token', { errors: errors.array() });
      return res.status(400).json({ errors: errors.array() });
    }
    next();
  },
  async (req: AuthRequest, res) => {
    try {
      const { fileId, expiresIn } = req.body;
      const file = await FileModel.findById(fileId);
      if (!file) {
        logger.warn(`File not found for fileId: ${fileId}`);
        return res.status(404).json({ error: 'File not found' });
      }

      // ensure owner
      if (String(file.userId) !== String(req.user?.id || req.user?._id)) {
        logger.warn(`Unauthorized access attempt by user: ${req.user?.id || req.user?._id}`);
        return res.status(403).json({ error: 'Forbidden' });
      }

      const token = signFileToken({ path: file.path }, expiresIn || '5m');
      const url = createDownloadUrl(token);
      const decoded: any = jwt.decode(token) || {};
      const expiresAt = decoded.exp ? new Date(decoded.exp * 1000).toISOString() : null;

      logger.info(`Token generated for fileId: ${fileId} by user: ${req.user?.id || req.user?._id}`);
      res.json({ token, url, expiresAt });
    } catch (error) {
      logger.error('Error in /generate-token endpoint', { error });
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

export default router;
