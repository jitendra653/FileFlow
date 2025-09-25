import mongoose from 'mongoose';
import logger from './logger';

interface AuditLogData {
  action: string;
  adminId: string;
  targetId?: string;
  targetType?: string;
  details: any;
  changes?: {
    before: any;
    after: any;
  };
  metadata?: Record<string, any>;
  ip?: string;
  userAgent?: string;
}

const auditSchema = new mongoose.Schema({
  action: { type: String, required: true, index: true },
  adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  targetId: { type: String, index: true },
  targetType: { type: String, index: true },
  details: { type: mongoose.Schema.Types.Mixed },
  changes: {
    before: mongoose.Schema.Types.Mixed,
    after: mongoose.Schema.Types.Mixed
  },
  metadata: mongoose.Schema.Types.Mixed,
  ip: { type: String, index: true },
  userAgent: String,
  timestamp: { type: Date, default: Date.now, index: true }
});

// Create compound indexes for common queries
auditSchema.index({ action: 1, timestamp: -1 });
auditSchema.index({ targetId: 1, targetType: 1, timestamp: -1 });
auditSchema.index({ adminId: 1, action: 1, timestamp: -1 });

const AuditModel = mongoose.model('Audit', auditSchema);

export const createAuditLog = async (data: AuditLogData) => {
  try {
    const audit = new AuditModel({
      ...data,
      timestamp: new Date()
    });
    
    await audit.save();
    
    logger.info('Audit log created', {
      action: data.action,
      adminId: data.adminId,
      targetId: data.targetId,
      targetType: data.targetType,
      ip: data.ip
    });
  } catch (error) {
    logger.error('Error creating audit log:', { 
      error: error instanceof Error ? error.message : 'Unknown error',
      data 
    });
    throw error;
  }
};

export const getAuditLogs = async ({
  adminId,
  action,
  targetId,
  targetType,
  startDate,
  endDate,
  ip,
  page = 1,
  limit = 50
}: {
  adminId?: string;
  action?: string;
  targetId?: string;
  targetType?: string;
  startDate?: Date;
  endDate?: Date;
  ip?: string;
  page?: number;
  limit?: number;
}) => {
  try {
    const query: Record<string, any> = {};
    
    if (adminId) query.adminId = adminId;
    if (action) query.action = action;
    if (targetId) query.targetId = targetId;
    if (targetType) query.targetType = targetType;
    if (ip) query.ip = ip;
    
    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) query.timestamp.$gte = startDate;
      if (endDate) query.timestamp.$lte = endDate;
    }

    const [logs, total] = await Promise.all([
      AuditModel.find(query)
        .sort({ timestamp: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('adminId', 'email name'),
      AuditModel.countDocuments(query)
    ]);

    return {
      logs,
      pagination: {
        total,
        totalPages: Math.ceil(total / limit),
        page,
        limit
      }
    };
  } catch (error) {
    logger.error('Error fetching audit logs:', { 
      error: error instanceof Error ? error.message : 'Unknown error',
      query: { adminId, action, targetId, targetType, startDate, endDate, ip }
    });
    throw error;
  }
};

export const getAuditLogsSummary = async (timeframe: {
  startDate: Date;
  endDate: Date;
}) => {
  try {
    const { startDate, endDate } = timeframe;
    
    const [actionSummary, adminSummary] = await Promise.all([
      // Get summary by action
      AuditModel.aggregate([
        {
          $match: {
            timestamp: { $gte: startDate, $lte: endDate }
          }
        },
        {
          $group: {
            _id: '$action',
            count: { $sum: 1 }
          }
        },
        {
          $sort: { count: -1 }
        }
      ]),
      
      // Get summary by admin
      AuditModel.aggregate([
        {
          $match: {
            timestamp: { $gte: startDate, $lte: endDate }
          }
        },
        {
          $group: {
            _id: '$adminId',
            count: { $sum: 1 }
          }
        },
        {
          $sort: { count: -1 }
        },
        {
          $limit: 10
        },
        {
          $lookup: {
            from: 'users',
            localField: '_id',
            foreignField: '_id',
            as: 'admin'
          }
        },
        {
          $unwind: '$admin'
        },
        {
          $project: {
            admin: { email: 1, name: 1 },
            count: 1
          }
        }
      ])
    ]);

    return {
      actionSummary,
      adminSummary,
      timeframe: {
        startDate,
        endDate
      }
    };
  } catch (error) {
    logger.error('Error generating audit logs summary:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      timeframe
    });
    throw error;
  }
};