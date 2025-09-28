import express from 'express';
import {requireAdmin} from '../middleware/adminAuth';
import UserModel from '../models/user';
import FileModel from '../models/file';

const router = express.Router();

// GET /v1/admin/analytics - Return platform analytics summary
router.get('/', requireAdmin, async (req, res) => {
  try {
    const totalUsers = await UserModel.countDocuments();
    const activeUsers = await UserModel.countDocuments({ status: 'active' });
    const filesUploaded = await FileModel.countDocuments();
    const storageUsedAgg = await FileModel.aggregate([
      { $group: { _id: null, total: { $sum: '$size' } } }
    ]);
    const storageUsed = storageUsedAgg[0]?.total || 0;
    // Daily active users (last 14 days)
    const since = new Date();
    since.setDate(since.getDate() - 14);
    const dailyActive = await UserModel.aggregate([
      { $match: { lastActive: { $gte: since } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$lastActive' } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);
    res.json({
      totalUsers,
      activeUsers,
      filesUploaded,
      storageUsed,
      dailyActive: dailyActive.map(d => ({ date: d._id, count: d.count }))
    });
  } catch (err) {
    res.status(500).json({ error: 'Could not load analytics' });
  }
});

export default router;
