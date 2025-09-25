import archiver from 'archiver';
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

// Bulk image download as ZIP
router.post('/user-files/bulk-download', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { fileIds } = req.body;
    if (!Array.isArray(fileIds) || !fileIds.length) {
      return res.status(400).json({ error: 'fileIds array required' });
    }
    const files = await FileModel.find({ _id: { $in: fileIds }, userId: req?.user?.userId });
    if (!files.length) return res.status(404).json({ error: 'No files found' });
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="images.zip"');
    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.pipe(res);
    for (const file of files) {
      archive.file(file.path, { name: file.originalName || file.name });
    }
    archive.finalize();
  } catch (error) {
    logger.error('Error in bulk download', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
});
// Save gallery order (drag-and-drop)
router.post('/user-files/reorder', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { order } = req.body;
    // Save order to user profile or a separate collection (not implemented: demo only)
    // await UserModel.findByIdAndUpdate(req.user?.id, { $set: { galleryOrder: order } });
    res.json({ message: 'Order saved', order });
  } catch (error) {
    logger.error('Error saving gallery order', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Save image annotation
router.patch('/user-files/:fileId/annotation', requireAuth, [
  body('annotation').isString().withMessage('Annotation required')
], async (req: AuthRequest, res) => {
  try {
    const file = await FileModel.findOne({ _id: req.params.fileId, userId: req?.user?.userId });
    if (!file || !file.mimeType.startsWith('image/')) return res.status(404).json({ error: 'Image file not found' });
    file.annotation = req.body.annotation;
    await file.save();
    res.json({ message: 'Annotation saved', file });
  } catch (error) {
    logger.error('Error saving annotation', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
});
// --- Advanced Image Gallery API Features ---

// Generate shareable link for image
router.post('/user-files/:fileId/share', requireAuth, async (req: AuthRequest, res) => {
  try {
    const file = await FileModel.findOne({ _id: req.params.fileId, userId: req?.user?.userId });

    if (!file || !file.mimeType.startsWith('image/')) return res.status(404).json({ error: 'Image file not found' });
    const token = signFileToken({ path: file.path, purpose: 'preview' }, '7d');
    res.json({ url: `${req.protocol}://${req.get('host')}/v1/files/preview?token=${token}` });
  } catch (error) {
    logger.error('Error generating shareable link', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Favorite/unfavorite image
router.post('/user-files/:fileId/favorite', requireAuth, async (req: AuthRequest, res) => {
  try {
    const file = await FileModel.findOne({ _id: req.params.fileId, userId: req?.user?.userId });
    if (!file || !file.mimeType.startsWith('image/')) return res.status(404).json({ error: 'Image file not found' });
    file.isFavorite = !file.isFavorite;
    await file.save();
    res.json({ message: file.isFavorite ? 'Image favorited' : 'Image unfavorited', file });
  } catch (error) {
    logger.error('Error updating favorite status', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update image metadata (caption, tags)
router.patch('/user-files/:fileId/metadata', requireAuth, [
  body('caption').optional().isString(),
  body('tags').optional().isArray()
], async (req: AuthRequest, res) => {
  try {
    const file = await FileModel.findOne({ _id: req.params.fileId, userId: req?.user?.userId });
    if (!file || !file.mimeType.startsWith('image/')) return res.status(404).json({ error: 'Image file not found' });
    if (req.body.caption) file.caption = req.body.caption;
    if (req.body.tags) file.tags = req.body.tags;
    await file.save();
    res.json({ message: 'Metadata updated', file });
  } catch (error) {
    logger.error('Error updating image metadata', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
});
// --- Advanced File Management & Image Transformation ---

// Rename file
router.patch('/user-files/:fileId', requireAuth, [
  body('name').isString().withMessage('New name is required')
], async (req: AuthRequest, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const file = await FileModel.findOne({ _id: req.params.fileId, userId: req?.user?.userId });
    if (!file) return res.status(404).json({ error: 'File not found' });
    file.originalName = req.body.name;
    await file.save();
    res.json({ message: 'File renamed', file });
  } catch (error) {
    logger.error('Error renaming file', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete file
router.delete('/user-files/:fileId', requireAuth, async (req: AuthRequest, res) => {
  try {
    const file = await FileModel.findOne({ _id: req.params.fileId, userId: req?.user?.userId });
    if (!file) return res.status(404).json({ error: 'File not found' });
    try {
      await fs.promises.unlink(file.path);
    } catch (error) {
      logger.error('Error deleting file from disk', { error });
    }
    await file.delete();
    res.json({ message: 'File deleted' });
  } catch (error) {
    logger.error('Error deleting file', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Image transformation (resize, crop, rotate)
import sharp from 'sharp';
router.post('/transform/:fileId', requireAuth, [
  body('type').isIn(['resize', 'rotate', 'crop']).withMessage('Invalid transform type'),
  body('value').isString().withMessage('Transform value required')
], async (req: AuthRequest, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const file = await FileModel.findOne({ _id: req.params.fileId, userId: req?.user?.userId });
    if (!file || !file.mimeType.startsWith('image/')) return res.status(404).json({ error: 'Image file not found' });
    const ext = path.extname(file.path);
    const outPath = file.path.replace(ext, `-transformed-${Date.now()}${ext}`);
    let image = sharp(file.path);
    if (req.body.type === 'resize') {
      const [w, h] = req.body.value.split('x').map(Number);
      image = image.resize(w, h);
    } else if (req.body.type === 'rotate') {
      const deg = parseInt(req.body.value);
      image = image.rotate(deg);
    } else if (req.body.type === 'crop') {
      const [w, h] = req.body.value.split('x').map(Number);
      image = image.extract({ left: 0, top: 0, width: w, height: h });
    }
    await image.toFile(outPath);
    res.json({ url: `/v1/files/preview?token=${signFileToken({ path: outPath, purpose: 'preview' }, '24h')}` });
  } catch (error) {
    logger.error('Error transforming image', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

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
    logger.error('Error fetching user files', { error, userId: req?.user?.userId });
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
    if (!file) return res.status(404).json({ error: 'File not found for preview', path: filePath });

    const abs = path.resolve(filePath);

    // Set content disposition to inline for preview
    res.setHeader('Content-Disposition', `inline; filename="${file.originalName}"`);
    // Always set a valid image Content-Type header
    if (file.mimeType && file.mimeType.startsWith('image/')) {
      res.setHeader('Content-Type', file.mimeType);
    } else {
      res.setHeader('Content-Type', 'image/png'); // fallback for browser ORB
    }

    return res.sendFile(abs, (err) => {
      if (err) {
        return res.status(500).json({ error: 'Error sending file for preview', details: err.message, path: filePath });
      }
    });
  } catch (err) {
    return res.status(400).json({ error: 'Invalid or expired token', details: err?.message });
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
