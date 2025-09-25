import { Request, Response, NextFunction } from 'express';
import { createAuditLog } from '../utils/auditLogger';
import { AuthRequest } from './auth';

export const auditMiddleware = (actionCategory: string) => {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    // Store the original send/json methods
    const originalSend = res.send;
    const originalJson = res.json;

    // Track the response data
    let responseData: any;

    // Override send method
    res.send = function (body: any): Response {
      responseData = body;
      return originalSend.call(this, body);
    };

    // Override json method
    res.json = function (body: any): Response {
      responseData = body;
      return originalJson.call(this, body);
    };

    // Once the response is finished, create the audit log
    res.on('finish', () => {
      const adminId = req.user?._id;
      if (!adminId) return;

      const auditData = {
        action: `${actionCategory}.${req.method.toLowerCase()}`,
        adminId,
        details: {
          method: req.method,
          path: req.path,
          params: req.params,
          query: req.query,
          body: req.body,
          response: responseData,
          status: res.statusCode
        },
        ip: req.ip,
        userAgent: req.get('user-agent')
      };

      createAuditLog(auditData).catch(err => {
        console.error('Error creating audit log:', err);
      });
    });

    next();
  };
};