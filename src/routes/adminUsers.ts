import express from 'express';
import { body, query, validationResult } from 'express-validator';
import { requireAdmin, requireSuperAdmin } from '../middleware/adminAuth';
import { AuthRequest } from '../middleware/auth';
import UserModel from '../models/user';
import logger from '../utils/logger';
import { createAuditLog } from '../utils/auditLogger';

const router = express.Router();

// Get users with advanced filtering and pagination
router.get('/', requireAdmin, [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('search').optional().isString(),
  query('status').optional().isIn(['active', 'suspended', 'banned']),
  query('plan').optional().isIn(['free', 'basic', 'premium']),
  query('sortBy').optional().isIn(['createdAt', 'email', 'status', 'plan', 'apiCallsMade', 'storageUsed']),
  query('sortOrder').optional().isIn(['asc', 'desc']),
], async (req: AuthRequest, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const search = req.query.search as string;
    const status = req.query.status as string;
    const plan = req.query.plan as string;
    const sortBy = req.query.sortBy as string || 'createdAt';
    const sortOrder = req.query.sortOrder as string || 'desc';

    // Build query
    const query: any = {};
    if (status) query.status = status;
    if (plan) query.plan = plan;
    if (search) {
      query.$or = [
        { email: { $regex: search, $options: 'i' } },
        { userId: isNaN(Number(search)) ? undefined : Number(search) }
      ];
    }

    // Execute query with pagination
    const [users, total] = await Promise.all([
      UserModel.find(query)
        .sort({ [sortBy]: sortOrder === 'desc' ? -1 : 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .select('-password'),
      UserModel.countDocuments(query)
    ]);

    // Get usage statistics for filtered users
    const usageStats = await UserModel.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          totalApiCalls: { $sum: '$quota.apiCallsMade' },
          totalStorageUsed: { $sum: '$quota.storageUsed' },
          averageApiCalls: { $avg: '$quota.apiCallsMade' },
          averageStorageUsed: { $avg: '$quota.storageUsed' }
        }
      }
    ]);

    res.json({
      users,
      pagination: {
        total,
        pages: Math.ceil(total / limit),
        page,
        limit
      },
      stats: usageStats[0] || {
        totalApiCalls: 0,
        totalStorageUsed: 0,
        averageApiCalls: 0,
        averageStorageUsed: 0
      }
    });
  } catch (error) {
    logger.error('Error in admin users list:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Bulk user actions
router.post('/bulk-action', requireAdmin, [
  body('userIds').isArray().withMessage('userIds must be an array'),
  body('userIds.*').isString().withMessage('Each userId must be a string'),
  body('action').isIn(['suspend', 'activate', 'delete', 'upgrade', 'downgrade'])
    .withMessage('Invalid action'),
  body('plan').optional().isIn(['free', 'basic', 'premium'])
], async (req: AuthRequest, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { userIds, action, plan } = req.body;
    const adminUser = await UserModel.findById(req.user?.id);

    // Check if admin has permission for the action
    if (action === 'delete' && adminUser?.role !== 'superadmin') {
      return res.status(403).json({ error: 'Only superadmins can delete users' });
    }

    let updateData = {};
    switch (action) {
      case 'suspend':
        updateData = { status: 'suspended' };
        break;
      case 'activate':
        updateData = { status: 'active' };
        break;
      case 'upgrade':
      case 'downgrade':
        if (!plan) {
          return res.status(400).json({ error: 'Plan is required for upgrade/downgrade' });
        }
        updateData = { plan };
        break;
    }

    if (action === 'delete') {
      // Soft delete users
      await UserModel.updateMany(
        { _id: { $in: userIds } },
        { status: 'deleted', deletedAt: new Date() }
      );
    } else {
      // Update users
      await UserModel.updateMany(
        { _id: { $in: userIds } },
        updateData
      );
    }

    // Create audit log
    await createAuditLog({
      action: `BULK_USER_${action.toUpperCase()}`,
      adminId: req.user?.id,
      details: {
        userIds,
        action,
        plan,
        updateData
      }
    });

    res.json({ 
      message: 'Bulk action completed successfully',
      affected: userIds.length
    });
  } catch (error) {
    logger.error('Error in bulk user action:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get user activity logs
router.get('/:userId/activity', requireAdmin, async (req: AuthRequest, res) => {
  try {
    const userId = req.params.userId;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;

    const user = await UserModel.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get user's API calls grouped by endpoint
    const apiUsage = await UserModel.aggregate([
      { $match: { _id: user._id } },
      { $unwind: '$quota.apiUsageHistory' },
      { $unwind: '$quota.apiUsageHistory.endpoints' },
      {
        $group: {
          _id: '$quota.apiUsageHistory.endpoints.key',
          totalCalls: { $sum: '$quota.apiUsageHistory.endpoints.value' },
          lastUsed: { $max: '$quota.apiUsageHistory.date' }
        }
      },
      { $sort: { totalCalls: -1 } }
    ]);

    // Get user's storage usage trend
    const storageUsage = await UserModel.aggregate([
      { $match: { _id: user._id } },
      { $unwind: '$quota.apiUsageHistory' },
      {
        $group: {
          _id: {
            $dateToString: {
              format: '%Y-%m-%d',
              date: '$quota.apiUsageHistory.date'
            }
          },
          storageUsed: { $last: '$quota.storageUsed' },
          apiCalls: { $sum: '$quota.apiUsageHistory.calls' }
        }
      },
      { $sort: { '_id': -1 } },
      { $limit: 30 }
    ]);

    res.json({
      user: {
        email: user.email,
        status: user.status,
        plan: user.plan,
        createdAt: user.createdAt
      },
      apiUsage,
      storageUsage,
      currentQuota: user.quota
    });
  } catch (error) {
    logger.error('Error fetching user activity:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;