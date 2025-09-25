import express from 'express';
import { body, query, validationResult } from 'express-validator';
import { requireAuth, AuthRequest } from '../middleware/auth';
import UserModel from '../models/user';
import FileModel from '../models/file';
import logger from '../utils/logger';
import bcrypt from 'bcrypt';

const router = express.Router();
// GET /profile/me - returns authenticated user's profile
router.get('/me',
  requireAuth,
  async (req: AuthRequest, res) => {
    try {
      const user = await UserModel.findById(req.user?.id || req.user?._id)
        .select('-password');

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Get user's storage usage and file stats
      const [storageStats, fileStats] = await Promise.all([
        FileModel.aggregate([
          { $match: { userId: user.userId } },
          { $group: {
            _id: null,
            totalSize: { $sum: '$size' },
            totalFiles: { $sum: 1 }
          }}
        ]),
        FileModel.aggregate([
          { $match: { userId: user.userId } },
          { $group: {
            _id: '$category',
            count: { $sum: 1 },
            totalSize: { $sum: '$size' }
          }}
        ])
      ]);

      const userProfile = {
        ...user.toObject(),
        storage: {
          used: storageStats[0]?.totalSize || 0,
          total: user.quota.storageLimit,
          filesCount: storageStats[0]?.totalFiles || 0
        },
        categories: fileStats
      };

      res.json(userProfile);
    } catch (error) {
      logger.error('Error fetching user profile', { error });
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

router.get('/',
  requireAuth,
  async (req: AuthRequest, res) => {
    try {
      const user = await UserModel.findById(req.user?.id || req.user?._id)
        .select('-password');

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Get user's storage usage and file stats
      const [storageStats, fileStats] = await Promise.all([
        FileModel.aggregate([
          { $match: { userId: user.userId } },
          { $group: {
            _id: null,
            totalSize: { $sum: '$size' },
            totalFiles: { $sum: 1 }
          }}
        ]),
        FileModel.aggregate([
          { $match: { userId: user.userId } },
          { $group: {
            _id: '$category',
            count: { $sum: 1 },
            totalSize: { $sum: '$size' }
          }}
        ])
      ]);

      const userProfile = {
        ...user.toObject(),
        storage: {
          used: storageStats[0]?.totalSize || 0,
          total: user.quota.storageLimit,
          filesCount: storageStats[0]?.totalFiles || 0
        },
        categories: fileStats
      };

      res.json(userProfile);
    } catch (error) {
      logger.error('Error fetching user profile', { error });
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

router.patch('/',
  requireAuth,
  [
    body('email').optional().isEmail().withMessage('Invalid email'),
    body('currentPassword').optional().isString().withMessage('Current password is required for password change'),
    body('newPassword').optional().isString().withMessage('New password is required')
  ],
  async (req: AuthRequest, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const user = await UserModel.findById(req.user?.id || req.user?._id);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Handle password change
      if (req.body.newPassword) {
        if (!req.body.currentPassword) {
          return res.status(400).json({ error: 'Current password is required' });
        }

        const isMatch = await bcrypt.compare(req.body.currentPassword, user.password);
        if (!isMatch) {
          return res.status(400).json({ error: 'Current password is incorrect' });
        }

        user.password = await bcrypt.hash(req.body.newPassword, 10);
      }

      // Update email if provided
      if (req.body.email && req.body.email !== user.email) {
        const emailExists = await UserModel.findOne({ email: req.body.email });
        if (emailExists) {
          return res.status(400).json({ error: 'Email already in use' });
        }
        user.email = req.body.email;
      }

      await user.save();
      logger.info(`Updated profile for user: ${user.id}`);

      const updatedUser = await UserModel.findById(user.id).select('-password');
      res.json(updatedUser);
    } catch (error) {
      logger.error('Error updating user profile', { error });
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

router.get('/storage/stats',
  requireAuth,
  async (req: AuthRequest, res) => {
    try {
      const user = await UserModel.findById(req.user?.id || req.user?._id);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      const stats = await Promise.all([
        FileModel.aggregate([
          { $match: { userId: user.userId } },
          { $group: {
            _id: null,
            totalSize: { $sum: '$size' },
            totalFiles: { $sum: 1 },
            totalDownloads: { $sum: '$downloads' }
          }}
        ]),
        FileModel.aggregate([
          { $match: { userId: user.userId } },
          { $group: {
            _id: '$category',
            count: { $sum: 1 },
            totalSize: { $sum: '$size' }
          }}
        ]),
        FileModel.aggregate([
          { $match: { userId: user.userId } },
          { $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            count: { $sum: 1 },
            size: { $sum: '$size' }
          }},
          { $sort: { _id: -1 } },
          { $limit: 30 }
        ])
      ]);

      const [overview, categoryBreakdown, dailyActivity] = stats;

      res.json({
        overview: {
          totalSize: overview[0]?.totalSize || 0,
          totalFiles: overview[0]?.totalFiles || 0,
          totalDownloads: overview[0]?.totalDownloads || 0,
          storageLimit: user.quota.storageLimit,
          storageUsed: user.quota.storageUsed
        },
        categoryBreakdown,
        dailyActivity
      });
    } catch (error) {
      logger.error('Error fetching storage stats', { error });
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

router.post('/files/bulk-operations',
  requireAuth,
  [
    body('fileIds').isArray().withMessage('fileIds must be an array'),
    body('fileIds.*').isString().withMessage('Each fileId must be a string'),
    body('operation').isIn(['move', 'delete', 'updateCategory']).withMessage('Invalid operation'),
    body('category').optional().isString().withMessage('category must be a string')
  ],
  async (req: AuthRequest, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { fileIds, operation, category } = req.body;
      const user = await UserModel.findById(req.user?.id || req.user?._id);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      const files = await FileModel.find({
        _id: { $in: fileIds },
        userId: user.userId
      });

      if (files.length === 0) {
        return res.status(404).json({ error: 'No files found' });
      }

      const results = {
        success: 0,
        failed: 0,
        errors: [] as string[]
      };

      for (const file of files) {
        try {
          switch (operation) {
            case 'delete':
              await fs.unlink(file.path);
              await file.delete();
              break;

            case 'updateCategory':
              if (!category) {
                throw new Error('Category is required for updateCategory operation');
              }
              file.category = category;
              await file.save();
              break;

            default:
              throw new Error(`Unsupported operation: ${operation}`);
          }
          results.success++;
        } catch (error) {
          results.failed++;
          results.errors.push(`File ${file.id}: ${(error as Error).message}`);
          logger.error(`Error in bulk operation`, { error, fileId: file.id });
        }
      }

      logger.info(`Bulk operation completed for user: ${user.id}`, results);
      res.json(results);
    } catch (error) {
      logger.error('Error in bulk operation', { error });
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// IP Whitelist Management Routes
router.post('/ip-whitelist/enable', requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = await UserModel.findById(req.user?.id || req.user?._id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    user.securitySettings = user.securitySettings || {};
    user.securitySettings.ipWhitelist = user.securitySettings.ipWhitelist || { enabled: false, ips: [] };
    user.securitySettings.ipWhitelist.enabled = true;
    await user.save();
    res.json({ success: true });
  } catch (error) {
    logger.error('Error enabling IP whitelist', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/ip-whitelist/disable', requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = await UserModel.findById(req.user?.id || req.user?._id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    user.securitySettings = user.securitySettings || {};
    user.securitySettings.ipWhitelist = user.securitySettings.ipWhitelist || { enabled: false, ips: [] };
    user.securitySettings.ipWhitelist.enabled = false;
    await user.save();
    res.json({ success: true });
  } catch (error) {
    logger.error('Error disabling IP whitelist', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/ip-whitelist/add', requireAuth, [body('ip').isString().withMessage('IP is required')], async (req: AuthRequest, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const user = await UserModel.findById(req.user?.id || req.user?._id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    user.securitySettings = user.securitySettings || {};
    user.securitySettings.ipWhitelist = user.securitySettings.ipWhitelist || { enabled: false, ips: [] };
    if (!user.securitySettings.ipWhitelist.ips.includes(req.body.ip)) {
      user.securitySettings.ipWhitelist.ips.push(req.body.ip);
      await user.save();
    }
    res.json({ success: true });
  } catch (error) {
    logger.error('Error adding IP to whitelist', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/ip-whitelist/remove', requireAuth, [body('ip').isString().withMessage('IP is required')], async (req: AuthRequest, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const user = await UserModel.findById(req.user?.id || req.user?._id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    user.securitySettings = user.securitySettings || {};
    user.securitySettings.ipWhitelist = user.securitySettings.ipWhitelist || { enabled: false, ips: [] };
    user.securitySettings.ipWhitelist.ips = user.securitySettings.ipWhitelist.ips.filter((ip: string) => ip !== req.body.ip);
    await user.save();
    res.json({ success: true });
  } catch (error) {
    logger.error('Error removing IP from whitelist', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;