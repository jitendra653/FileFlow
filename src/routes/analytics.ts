import express from 'express';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { requireAdmin } from '../middleware/adminAuth';
import FileModel from '../models/file';
import UserModel from '../models/user';
import TransformationModel from '../models/transformation';
import logger, { queryLogs } from '../utils/logger';
import os from 'os';
import { performance } from 'perf_hooks';

const router = express.Router();

router.get('/plan', requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    const user = await UserModel.findById(userId);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const [fileStats, transformStats] = await Promise.all([
      FileModel.aggregate([
        { $match: { userId: user.userId } },
        {
          $group: {
            _id: null,
            totalSize: { $sum: '$size' },
            totalFiles: { $sum: 1 },
            totalDownloads: { $sum: '$downloads' }
          }
        }
      ]),
      TransformationModel.aggregate([
        { $match: { userId } },
        {
          $group: {
            _id: null,
            totalTransformations: { $sum: 1 },
            completedTransformations: {
              $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
            }
          }
        }
      ])
    ]);

    // Get popular categories
    const categories = await FileModel.aggregate([
      { $match: { userId: user.userId } },
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 }
    ]);

    // Get API usage history for chart
    const apiUsageHistory = user.quota.apiUsageHistory || [];
    const last7DaysUsage = apiUsageHistory
      .slice(-7)
      .map(day => ({
        date: day.date,
        calls: day.calls,
        endpoints: day.endpoints instanceof Map ? Object.fromEntries(day.endpoints) : day.endpoints
      }));

    // Calculate popular endpoints
    const endpointUsage = new Map();
    apiUsageHistory.forEach(day => {
      if (day.endpoints instanceof Map) {
        day.endpoints.forEach((count, endpoint) => {
          endpointUsage.set(endpoint, (endpointUsage.get(endpoint) || 0) + count);
        });
      } else if (typeof day.endpoints === 'object') {
        Object.entries(day.endpoints).forEach(([endpoint, count]) => {
          endpointUsage.set(endpoint, (endpointUsage.get(endpoint) || 0) + (count as number));
        });
      }
    });

    const popularEndpoints = Array.from(endpointUsage.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([endpoint, count]) => ({ endpoint, count }));

    res.json({
      storageUsed: user.quota.storageUsed,
      storageLimit: user.quota.storageLimit,
      apiCallsMade: user.quota.apiCallsMade,
      apiCallLimit: user.quota.apiCallLimit,
      apiUsage: {
        history: last7DaysUsage,
        popularEndpoints,
        nextReset: new Date(user.quota.lastResetDate),
      },
      totalFiles: fileStats[0]?.totalFiles || 0,
      totalDownloads: fileStats[0]?.totalDownloads || 0,
      transformations: {
        total: transformStats[0]?.totalTransformations || 0,
        completed: transformStats[0]?.completedTransformations || 0
      },
      popularCategories: categories.map(cat => ({
        name: cat._id || 'uncategorized',
        count: cat.count
      }))
    });
  } catch (error) {
    logger.error('Error fetching analytics:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// System-wide analytics for admins
router.get('/system', requireAdmin, async (req, res) => {
  try {
    // Get user statistics
    const userStats = await UserModel.aggregate([
      {
        $facet: {
          statusCounts: [
            {
              $group: {
                _id: '$status',
                count: { $sum: 1 }
              }
            }
          ],
          planCounts: [
            {
              $group: {
                _id: '$plan',
                count: { $sum: 1 }
              }
            }
          ],
          activityStats: [
            {
              $group: {
                _id: null,
                totalApiCalls: { $sum: '$quota.apiCallsMade' },
                totalStorage: { $sum: '$quota.storageUsed' },
                avgApiUsage: { $avg: '$quota.apiCallsMade' },
                avgStorage: { $avg: '$quota.storageUsed' }
              }
            }
          ]
        }
      }
    ]);

    // Get file statistics
    const fileStats = await FileModel.aggregate([
      {
        $facet: {
          byType: [
            {
              $group: {
                _id: '$type',
                count: { $sum: 1 },
                totalSize: { $sum: '$size' }
              }
            }
          ],
          timeStats: [
            {
              $group: {
                _id: {
                  $dateToString: {
                    format: '%Y-%m-%d',
                    date: '$createdAt'
                  }
                },
                count: { $sum: 1 },
                totalSize: { $sum: '$size' }
              }
            },
            { $sort: { '_id': -1 } },
            { $limit: 30 }
          ]
        }
      }
    ]);

    // Get transformation statistics
    const transformStats = await TransformationModel.aggregate([
      {
        $facet: {
          byStatus: [
            {
              $group: {
                _id: '$status',
                count: { $sum: 1 }
              }
            }
          ],
          byType: [
            {
              $group: {
                _id: '$type',
                count: { $sum: 1 },
                avgDuration: { $avg: '$duration' }
              }
            }
          ],
          timeStats: [
            {
              $group: {
                _id: {
                  $dateToString: {
                    format: '%Y-%m-%d',
                    date: '$createdAt'
                  }
                },
                count: { $sum: 1 },
                avgDuration: { $avg: '$duration' },
                successRate: {
                  $avg: {
                    $cond: [{ $eq: ['$status', 'completed'] }, 1, 0]
                  }
                }
              }
            },
            { $sort: { '_id': -1 } },
            { $limit: 30 }
          ]
        }
      }
    ]);

    // Get error rate and response time metrics
    // Adjusted: Fetch all logs in the last 24h, then filter for 'error' level
    const logs: any[] = await queryLogs({ limit: 50 });
  //   const logs = await logger.query({
  //   from: new Date(Date.now() - 24 * 60 * 60 * 1000), // last 24 hours
  //   until: new Date(),
  //   limit: 1000,
  //   order: "desc",
  //   fields: ["timestamp", "level", "message", "stack"]
  // });

    const errorLogs = logs.filter((log: any) => log.level === 'error');

    // Calculate system metrics
    const systemMetrics = {
      cpu: {
        usage: process.cpuUsage(),
        loadAvg: os.loadavg(),
        cores: os.cpus().length
      },
      memory: {
        total: os.totalmem(),
        free: os.freemem(),
        usage: process.memoryUsage()
      },
      uptime: process.uptime(),
      performance: {
        eventLoopLag: await measureEventLoopLag(),
        heapUsage: process.memoryUsage().heapUsed,
        heapTotal: process.memoryUsage().heapTotal
      }
    };

    res.json({
      users: {
        byStatus: userStats[0].statusCounts,
        byPlan: userStats[0].planCounts,
        activity: userStats[0].activityStats[0]
      },
      files: {
        byType: fileStats[0].byType,
        timeStats: fileStats[0].timeStats
      },
      transformations: {
        byStatus: transformStats[0].byStatus,
        byType: transformStats[0].byType,
        timeStats: transformStats[0].timeStats
      },
      errors: {
        count: errorLogs.length,
        rate: errorLogs.length / (24 * 60 * 60),
        recent: errorLogs.slice(0, 10).map(log => ({
          timestamp: log.timestamp,
          message: log.message,
          stack: log.stack
        }))
      },
      system: systemMetrics
    });
  } catch (error) {
    logger.error('Error fetching system analytics:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Real-time performance metrics
router.get('/performance', requireAdmin, async (req, res) => {
  try {
    const start = Date.now();
    const metrics = {
      timestamp: new Date(),
      cpu: {
        usage: process.cpuUsage(),
        loadAvg: os.loadavg()[0]
      },
      memory: {
        total: os.totalmem(),
        free: os.freemem(),
        usage: process.memoryUsage()
      },
      performance: {
  eventLoopLag: await measureEventLoopLag(),
  activeHandles: 0, // Not available in Node typings
  activeRequests: 0 // Not available in Node typings
      }
    };

    res.json({
      metrics,
      responseTime: Date.now() - start
    });
  } catch (error) {
    logger.error('Error fetching performance metrics:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// User activity trends
router.get('/trends/users', requireAdmin, async (req, res) => {
  try {
    const { period = '24h' } = req.query;
    const endDate = new Date();
    const startDate = getPeriodStartDate(period as string);

    const activityTrends = await UserModel.aggregate([
      {
        $match: {
          'lastLoginDate': { $gte: startDate }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: '%Y-%m-%d-%H',
              date: '$lastLoginDate'
            }
          },
          activeUsers: { $addToSet: '$_id' },
          totalApiCalls: { $sum: '$quota.apiCallsMade' },
          avgResponseTime: { $avg: '$quota.avgResponseTime' }
        }
      },
      { $sort: { '_id': 1 } }
    ]);

    res.json({
      period,
      trends: activityTrends
    });
  } catch (error) {
    logger.error('Error fetching user activity trends:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Helper function to measure event loop lag
async function measureEventLoopLag(): Promise<number> {
  return new Promise(resolve => {
    const start = performance.now();
    setImmediate(() => {
      resolve(performance.now() - start);
    });
  });
}

// Helper function to get start date based on period
function getPeriodStartDate(period: string): Date {
  const now = new Date();
  switch (period) {
    case '1h':
      return new Date(now.getTime() - 60 * 60 * 1000);
    case '24h':
      return new Date(now.getTime() - 24 * 60 * 60 * 1000);
    case '7d':
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    case '30d':
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    default:
      return new Date(now.getTime() - 24 * 60 * 60 * 1000);
  }
}

export default router;