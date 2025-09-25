import { Request, Response, NextFunction } from 'express';
import { IUser } from '../models/user';
import { verifyTOTP, verifyBackupCode } from '../utils/twoFactorAuth';
import logger from '../utils/logger';
import { createAuditLog } from '../utils/auditLogger';
import { securityMonitor } from '../utils/securityMonitor';

declare global {
  namespace Express {
    interface Request {
      user?: IUser;
    }
  }
}

export const require2FA = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user as IUser;
    
    // Skip 2FA check if user is not an admin or if 2FA is not enabled
    if (!user?.isAdmin || !user.securitySettings?.twoFactorAuth?.enabled) {
      return next();
    }

    const totpToken = req.header('X-TOTP-Token');
    const backupCode = req.header('X-Backup-Code');

    if (!totpToken && !backupCode) {
      return res.status(403).json({
        error: '2FA required',
        code: 'TWO_FACTOR_REQUIRED'
      });
    }

    let isValid = false;

    if (totpToken) {
      // Verify TOTP token
      isValid = verifyTOTP(
        totpToken,
        user.securitySettings.twoFactorAuth.secret || ''
      );
    } else if (backupCode) {
      // Verify backup code
      isValid = await verifyBackupCode(backupCode, user);
    }

    if (!isValid) {
      // Track and log failed 2FA attempt
      await Promise.all([
        createAuditLog({
          action: 'FAILED_2FA_ATTEMPT',
          adminId: user.id,
          targetId: user.id,
          targetType: 'USER',
          details: {
            usedBackupCode: !!backupCode
          },
          ip: req.ip
        }),
        securityMonitor.trackTwoFactorAttempt(false, user, req.ip)
      ]);

      logger.warn('Failed 2FA attempt', {
        userId: user.id,
        usedBackupCode: !!backupCode
      });

      return res.status(403).json({
        error: 'Invalid 2FA token or backup code',
        code: 'INVALID_TWO_FACTOR'
      });
    }

    next();
  } catch (error) {
    logger.error('Error in 2FA middleware:', error);
    next(error);
  }
};