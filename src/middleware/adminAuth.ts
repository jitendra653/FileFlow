import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from './auth';
import UserModel from '../models/user';
import logger from '../utils/logger';

// Middleware to check if user is a super admin
export const requireSuperAdmin = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id || req.user?._id;
    const user = await UserModel.findById(userId);

    if (!user) {
      logger.warn('User not found in requireSuperAdmin middleware');
      return res.status(404).json({ error: 'User not found' });
    }

    if (user.role !== 'superadmin') {
      logger.warn(`Unauthorized superadmin access attempt by user: ${userId}`);
      return res.status(403).json({ error: 'Access denied. Super admin privileges required.' });
    }

    next();
  } catch (error) {
    logger.error('Error in requireSuperAdmin middleware', { error });
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// Middleware to check if user is an admin or super admin
export const requireAdmin = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id || req.user?._id;
    const user = await UserModel.findById(userId);

    if (!user) {
      logger.warn('User not found in requireAdmin middleware');
      return res.status(404).json({ error: 'User not found' });
    }

    if (!['admin', 'superadmin'].includes(user.role)) {
      logger.warn(`Unauthorized admin access attempt by user: ${userId}`);
      return res.status(403).json({ error: 'Access denied. Admin privileges required.' });
    }

    next();
  } catch (error) {
    logger.error('Error in requireAdmin middleware', { error });
    return res.status(500).json({ error: 'Internal server error' });
  }
};