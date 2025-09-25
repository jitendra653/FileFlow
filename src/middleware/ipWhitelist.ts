import { Request, Response, NextFunction } from 'express';
import { IUser } from '../models/user';
import logger from '../utils/logger';
import { createAuditLog } from '../utils/auditLogger';
import { securityMonitor } from '../utils/securityMonitor';

// Extend express Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: IUser;
    }
  }
}

interface IpWhitelistConfig {
  enabled: boolean;
  ips: string[];
}

const isIpWhitelisted = (ip: string, whitelist: string[]): boolean => {
  return whitelist.some(whitelistedIp => {
    // Handle CIDR notation
    if (whitelistedIp.includes('/')) {
      // For simplicity, just check if IP starts with the same prefix
      // In production, use a proper CIDR checking library
      return ip.startsWith(whitelistedIp.split('/')[0]);
    }
    // Exact match
    return ip === whitelistedIp;
  });
};

export const ipWhitelist = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user as IUser;
    
    // Skip whitelist check if user is not an admin
    if (!user?.isAdmin) {
      return next();
    }

    const clientIp = req.ip || req.socket.remoteAddress || '';
    
    // Get the admin's IP whitelist configuration
    const whitelistConfig: IpWhitelistConfig = user.securitySettings?.ipWhitelist || { 
      enabled: false, 
      ips: [] 
    };

    // If whitelist is not enabled, allow access
    if (!whitelistConfig.enabled) {
      return next();
    }

    // Check if the client IP is whitelisted
    if (!isIpWhitelisted(clientIp, whitelistConfig.ips)) {
      // Log the unauthorized access attempt
      await createAuditLog({
        action: 'UNAUTHORIZED_IP_ACCESS',
        adminId: user.id,
        targetId: user.id,
        targetType: 'USER',
        details: {
          attemptedIp: clientIp,
          allowedIps: whitelistConfig.ips
        },
        ip: clientIp
      });

      logger.warn('Unauthorized IP access attempt', {
        userId: user.id,
        clientIp,
        allowedIps: whitelistConfig.ips
      });

      // Track unauthorized IP access
      await securityMonitor.trackUnauthorizedIPAccess(clientIp, user.id);

      return res.status(403).json({
        error: 'Access denied: IP not whitelisted',
        code: 'IP_NOT_WHITELISTED'
      });
    }

    next();
  } catch (error) {
    logger.error('Error in IP whitelist middleware', { error });
    next(error);
  }
};