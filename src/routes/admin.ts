import express from 'express';
import { body, query, validationResult } from 'express-validator';
import { requireAdmin, requireSuperAdmin } from '../middleware/adminAuth';
import { AuthRequest } from '../middleware/auth';
import UserModel from '../models/user';
import FileModel from '../models/file';
import logger from '../utils/logger';
import { FilterQuery } from 'mongoose';
import jwt from 'jsonwebtoken';


const router = express.Router();

router.get('/users', 
  requireAdmin,
  [
    query('page').optional().isInt({ min: 1 }).withMessage('page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('limit must be between 1 and 100'),
    query('role').optional().isIn(['user', 'admin', 'superadmin']).withMessage('Invalid role'),
    query('status').optional().isIn(['active', 'suspended', 'banned']).withMessage('Invalid status'),
    query('plan').optional().isIn(['free', 'basic', 'premium']).withMessage('Invalid plan'),
    query('sortBy').optional().isIn(['email', 'role', 'status', 'plan', 'createdAt']).withMessage('Invalid sortBy field'),
    query('order').optional().isIn(['asc', 'desc']).withMessage('Invalid order'),
    query('search').optional().isString().withMessage('search must be a string')
  ],
  async (req: AuthRequest, res) => {
    try {

              // return res.status(400).json({ errors: "errors.array()" });

      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const skip = (page - 1) * limit;

      // Build query
      const query: FilterQuery<typeof UserModel> = {};
      if (req.query.role) query.role = req.query.role;
      if (req.query.status) query.status = req.query.status;
      if (req.query.plan) query.plan = req.query.plan;
      if (req.query.search) {
        query.email = { $regex: req.query.search, $options: 'i' };
      }

      // Build sort options
      const sortBy = req.query.sortBy as string || 'createdAt';
      const order = req.query.order === 'asc' ? 1 : -1;
      const sort: [string, 1 | -1][] = [[sortBy, order]];

      const users = await UserModel
        .find(query)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .select('-password');

      const total = await UserModel.countDocuments(query);

      logger.info(`Retrieved ${users.length} users by admin: ${req.user?.id}`);

      res.json({
        users,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(total / limit),
          totalUsers: total,
          hasNext: skip + users.length < total,
          hasPrevious: page > 1
        }
      });
    } catch (error) {
      logger.error('Error fetching users', { error });
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);


router.get('/users/:userId', 
  requireAdmin,
  async (req: AuthRequest, res) => {
    try {
      const user = await UserModel.findById(req.params.userId).select('-password');
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      const filesCount = await FileModel.countDocuments({ userId: user.userId });
      const storageUsed = await FileModel.aggregate([
        { $match: { userId: user.userId } },
        { $group: { _id: null, total: { $sum: '$size' } } }
      ]);

      const userDetails = {
        ...user.toObject(),
        filesCount,
        storageUsed: storageUsed[0]?.total || 0
      };

      res.json(userDetails);
    } catch (error) {
      logger.error('Error fetching user details', { error });
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);


router.patch('/users/:userId/role',
  requireSuperAdmin,
  [
    body('role').isIn(['user', 'admin', 'superadmin']).withMessage('Invalid role')
  ],
  async (req: AuthRequest, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const user = await UserModel.findById(req.params.userId);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      user.role = req.body.role;
      await user.save();

      logger.info(`Updated user role: ${user.id} to ${req.body.role} by admin: ${req.user?.id}`);
      res.json({ message: 'User role updated successfully', user });
    } catch (error) {
      logger.error('Error updating user role', { error });
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);


router.patch('/users/:userId/status',
  requireAdmin,
  [
    body('status').isIn(['active', 'suspended', 'banned']).withMessage('Invalid status')
  ],
  async (req: AuthRequest, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const user = await UserModel.findById(req.params.userId);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      user.status = req.body.status;
      await user.save();

      logger.info(`Updated user status: ${user.id} to ${req.body.status} by admin: ${req.user?.id}`);
      res.json({ message: 'User status updated successfully', user });
    } catch (error) {
      logger.error('Error updating user status', { error });
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);


router.patch('/users/:userId/plan',
  requireAdmin,
  [
    body('plan').isIn(['free', 'basic', 'premium']).withMessage('Invalid plan')
  ],
  async (req: AuthRequest, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const user = await UserModel.findById(req.params.userId);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      user.plan = req.body.plan;
      await user.save();

      logger.info(`Updated user plan: ${user.id} to ${req.body.plan} by admin: ${req.user?.id}`);
      res.json({ message: 'User plan updated successfully', user });
    } catch (error) {
      logger.error('Error updating user plan', { error });
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);


router.delete('/users/:userId',
  requireSuperAdmin,
  async (req: AuthRequest, res) => {
    try {
      const user = await UserModel.findById(req.params.userId);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Delete all user files
      await FileModel.deleteMany({ userId: user.userId });
      await user.deleteOne();

      logger.info(`Deleted user: ${user.id} by admin: ${req.user?.id}`);
      res.json({ message: 'User and associated data deleted successfully' });
    } catch (error) {
      logger.error('Error deleting user', { error });
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);


router.get('/stats',
  requireAdmin,
  async (req: AuthRequest, res) => {
    try {
      const stats = await Promise.all([
        UserModel.countDocuments(),
        UserModel.countDocuments({ status: 'active' }),
        UserModel.countDocuments({ status: 'suspended' }),
        FileModel.countDocuments(),
        FileModel.aggregate([
          { $group: { _id: null, totalSize: { $sum: '$size' } } }
        ]),
        UserModel.aggregate([
          { $group: { _id: '$plan', count: { $sum: 1 } } }
        ])
      ]);

      const [
        totalUsers,
        activeUsers,
        suspendedUsers,
        totalFiles,
        totalStorage,
        planDistribution
      ] = stats;

      res.json({
        users: {
          total: totalUsers,
          active: activeUsers,
          suspended: suspendedUsers,
          banned: totalUsers - activeUsers - suspendedUsers
        },
        files: {
          total: totalFiles,
          totalStorage: totalStorage[0]?.totalSize || 0
        },
        plans: planDistribution.reduce((acc: any, curr: any) => {
          acc[curr._id] = curr.count;
          return acc;
        }, {})
      });
    } catch (error) {
      logger.error('Error fetching system stats', { error });
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);


router.post('/seed',
  requireSuperAdmin,
  [
    body('email').isEmail().withMessage('Invalid email'),
    body('password').isString().withMessage('Password is required'),
    body('role').optional().isIn(['user', 'admin', 'superadmin']).withMessage('Invalid role')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { email, password, role = 'user' } = req.body;

      let user = await UserModel.findOne({ email });
      if (user) {
        return res.status(400).json({ error: 'User already exists' });
      }

      user = await UserModel.create({ email, password, role });
      const token = jwt.sign({ id: user._id, email: user.email }, process.env.JWT_SECRET || 'dev_secret', { expiresIn: '7d' });
      
      logger.info(`Created new user: ${user.id} with role: ${role}`);
      res.json({ userId: user._id, token });
    } catch (error) {
      logger.error('Error in seed endpoint', { error });
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

export default router;
