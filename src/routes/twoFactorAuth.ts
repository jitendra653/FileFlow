import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { IUser } from '../models/user';
import session from 'express-session';

// Extend express-session with our custom properties
declare module 'express-session' {
  interface SessionData {
    tempTwoFactorSecret?: string;
    tempBackupCodes?: string[];
  }
}
import { generateTOTPConfig, verifyTOTP, generateNewBackupCodes } from '../utils/twoFactorAuth';
import { createAuditLog } from '../utils/auditLogger';
import logger from '../utils/logger';

const router = Router();



// Get 2FA setup information
router.get('/setup', requireAuth, async (req, res) => {
  try {
    const user = req.user as IUser;
    
    if (user.securitySettings?.twoFactorAuth?.enabled) {
      return res.status(400).json({
        error: '2FA is already enabled',
        code: 'TWO_FACTOR_ALREADY_ENABLED'
      });
    }

    const totpConfig = await generateTOTPConfig(user);
    
    // Store secret and backup codes temporarily in session
    req.session.tempTwoFactorSecret = totpConfig.secret;
    req.session.tempBackupCodes = totpConfig.backupCodes;

    res.json({
      qrCode: totpConfig.qrCodeUrl,
      backupCodes: totpConfig.backupCodes
    });
  } catch (error) {
    logger.error('Error in 2FA setup:', error);
    res.status(500).json({
      error: 'Failed to setup 2FA',
      code: 'TWO_FACTOR_SETUP_FAILED'
    });
  }
});

// POST 2FA setup (same as GET, for frontend compatibility)
router.post('/setup', requireAuth, async (req, res) => {
  try {
    const user = req.user as IUser;
    if (user.securitySettings?.twoFactorAuth?.enabled) {
      return res.status(400).json({
        error: '2FA is already enabled',
        code: 'TWO_FACTOR_ALREADY_ENABLED'
      });
    }
    const totpConfig = await generateTOTPConfig(user);
    req.session.tempTwoFactorSecret = totpConfig.secret;
    req.session.tempBackupCodes = totpConfig.backupCodes;
    res.json({
      qrCode: totpConfig.qrCodeUrl,
      backupCodes: totpConfig.backupCodes
    });
  } catch (error) {
    logger.error('Error in 2FA setup:', error);
    res.status(500).json({
      error: 'Failed to setup 2FA',
      code: 'TWO_FACTOR_SETUP_FAILED'
    });
  }
});


// Enable 2FA
router.post('/enable', requireAuth, async (req, res) => {
  try {
    const user = req.user as IUser;
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        error: 'TOTP token is required',
        code: 'TOKEN_REQUIRED'
      });
    }

    const secret = req.session.tempTwoFactorSecret;
    const backupCodes = req.session.tempBackupCodes;

    if (!secret || !backupCodes) {
      return res.status(400).json({
        error: '2FA setup not initiated',
        code: 'SETUP_NOT_INITIATED'
      });
    }

    // Verify the token
    const isValid = verifyTOTP(token, secret);

    if (!isValid) {
      return res.status(400).json({
        error: 'Invalid TOTP token',
        code: 'INVALID_TOKEN'
      });
    }

    // Enable 2FA
    user.securitySettings = {
      ...user.securitySettings,
      twoFactorAuth: {
        enabled: true,
        secret,
        backupCodes
      }
    };

    await user.save();

    // Clear temporary session data
    delete req.session.tempTwoFactorSecret;
    delete req.session.tempBackupCodes;

    await createAuditLog({
      action: 'ENABLE_2FA',
      adminId: user.id,
      targetId: user.id,
      targetType: 'USER',
      details: { method: 'TOTP' },
      ip: req.ip
    });

    res.json({
      message: '2FA enabled successfully',
      backupCodes
    });
  } catch (error) {
    logger.error('Error enabling 2FA:', error);
    res.status(500).json({
      error: 'Failed to enable 2FA',
      code: 'TWO_FACTOR_ENABLE_FAILED'
    });
  }
});

// Disable 2FA
router.post('/disable', requireAuth, async (req, res) => {
  try {
    const user = req.user as IUser;
    const { token } = req.body;

    if (!user.securitySettings?.twoFactorAuth?.enabled) {
      return res.status(400).json({
        error: '2FA is not enabled',
        code: 'TWO_FACTOR_NOT_ENABLED'
      });
    }

    // Verify the token before disabling
    const isValid = verifyTOTP(
      token,
      user.securitySettings.twoFactorAuth.secret || ''
    );

    if (!isValid) {
      return res.status(400).json({
        error: 'Invalid TOTP token',
        code: 'INVALID_TOKEN'
      });
    }

    // Disable 2FA
    if (user.securitySettings?.twoFactorAuth) {
      user.securitySettings.twoFactorAuth.enabled = false;
      user.securitySettings.twoFactorAuth.secret = undefined;
      user.securitySettings.twoFactorAuth.backupCodes = undefined;
    }

    await user.save();

    await createAuditLog({
      action: 'DISABLE_2FA',
      adminId: user.id,
      targetId: user.id,
      targetType: 'USER',
      details: { method: 'TOTP' },
      ip: req.ip
    });

    res.json({ message: '2FA disabled successfully' });
  } catch (error) {
    logger.error('Error disabling 2FA:', error);
    res.status(500).json({
      error: 'Failed to disable 2FA',
      code: 'TWO_FACTOR_DISABLE_FAILED'
    });
  }
});

// Generate new backup codes
router.post('/backup-codes', requireAuth, async (req, res) => {
  try {
    const user = req.user as IUser;
    const { token } = req.body;

    if (!user.securitySettings?.twoFactorAuth?.enabled) {
      return res.status(400).json({
        error: '2FA is not enabled',
        code: 'TWO_FACTOR_NOT_ENABLED'
      });
    }

    // Verify the token before generating new codes
    const isValid = verifyTOTP(
      token,
      user.securitySettings.twoFactorAuth.secret || ''
    );

    if (!isValid) {
      return res.status(400).json({
        error: 'Invalid TOTP token',
        code: 'INVALID_TOKEN'
      });
    }

    // Generate and save new backup codes
    const newBackupCodes = generateNewBackupCodes();
    user.securitySettings.twoFactorAuth.backupCodes = newBackupCodes;
    await user.save();

    await createAuditLog({
      action: 'GENERATE_2FA_BACKUP_CODES',
      adminId: user.id,
      targetId: user.id,
      targetType: 'USER',
      details: { method: 'TOTP' },
      ip: req.ip
    });

    res.json({
      message: 'New backup codes generated',
      backupCodes: newBackupCodes
    });
  } catch (error) {
    logger.error('Error generating backup codes:', error);
    res.status(500).json({
      error: 'Failed to generate backup codes',
      code: 'BACKUP_CODES_GENERATION_FAILED'
    });
  }
});

// POST /verify - verify TOTP code and enable 2FA
router.post('/verify', requireAuth, async (req, res) => {
  try {
    const user = req.user as IUser;
    const { code } = req.body;
    const secret = req.session.tempTwoFactorSecret;
    const backupCodes = req.session.tempBackupCodes;
    if (!secret || !backupCodes) {
      return res.status(400).json({ error: '2FA setup not initiated' });
    }
    if (!code) {
      return res.status(400).json({ error: 'TOTP code is required' });
    }
    const isValid = verifyTOTP(code, secret);
    if (!isValid) {
      return res.status(400).json({ error: 'Invalid TOTP code' });
    }
    user.securitySettings = {
      ...user.securitySettings,
      twoFactorAuth: {
        enabled: true,
        secret,
        backupCodes
      }
    };
    await user.save();
    delete req.session.tempTwoFactorSecret;
    delete req.session.tempBackupCodes;
    await createAuditLog({
      action: 'VERIFY_2FA',
      adminId: user.id,
      targetId: user.id,
      targetType: 'USER',
      details: { method: 'TOTP' },
      ip: req.ip
    });
    res.json({ success: true });
  } catch (error) {
    logger.error('Error verifying 2FA:', error);
    res.status(500).json({ error: 'Failed to verify 2FA' });
  }
});

export default router;