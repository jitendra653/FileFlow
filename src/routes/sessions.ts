import { Router } from 'express';
import { IUser } from '../models/user';
import { SessionManager } from '../config/session';
import { createAuditLog } from '../utils/auditLogger';
import logger from '../utils/logger';

const router = Router();

// Get all active sessions for the current user
router.get('/', async (req, res) => {
  try {
    const user = req.user as IUser;
    const sessions = SessionManager.getUserSessions(user.id);

    res.json({ 
      sessions: sessions.map(sessionId => ({
        id: sessionId,
        current: sessionId === req.sessionID,
        deviceInfo: req.session.deviceInfo
      }))
    });
  } catch (error) {
    logger.error('Error fetching sessions:', error);
    res.status(500).json({
      error: 'Failed to fetch sessions',
      code: 'FETCH_SESSIONS_FAILED'
    });
  }
});

// Terminate specific session
router.delete('/:sessionId', async (req, res) => {
  try {
    const user = req.user as IUser;
    const { sessionId } = req.params;

    // Don't allow terminating current session through this endpoint
    if (sessionId === req.sessionID) {
      return res.status(400).json({
        error: 'Cannot terminate current session',
        code: 'CURRENT_SESSION_TERMINATION_DENIED'
      });
    }

    await SessionManager.terminateUserSessions(user.id, sessionId);

    await createAuditLog({
      action: 'TERMINATE_SESSION',
      adminId: user.id,
      targetId: user.id,
      targetType: 'SESSION',
      details: { sessionId },
      ip: req.ip
    });

    res.json({ message: 'Session terminated successfully' });
  } catch (error) {
    logger.error('Error terminating session:', error);
    res.status(500).json({
      error: 'Failed to terminate session',
      code: 'SESSION_TERMINATION_FAILED'
    });
  }
});

// Terminate all other sessions
router.delete('/', async (req, res) => {
  try {
    const user = req.user as IUser;
    
    // Keep current session, terminate all others
    await SessionManager.terminateUserSessions(user.id, req.sessionID);

    await createAuditLog({
      action: 'TERMINATE_ALL_SESSIONS',
      adminId: user.id,
      targetId: user.id,
      targetType: 'SESSION',
      details: { exceptSessionId: req.sessionID },
      ip: req.ip
    });

    res.json({ message: 'All other sessions terminated successfully' });
  } catch (error) {
    logger.error('Error terminating all sessions:', error);
    res.status(500).json({
      error: 'Failed to terminate sessions',
      code: 'SESSIONS_TERMINATION_FAILED'
    });
  }
});

// Update session timeout
router.put('/session/timeout', async (req, res) => {
  try {
    const user = req.user as IUser;
    const { timeout } = req.body;

    if (!timeout || typeof timeout !== 'number' || timeout < 300 || timeout > 86400) {
      return res.status(400).json({
        error: 'Invalid timeout value. Must be between 5 minutes and 24 hours.',
        code: 'INVALID_TIMEOUT'
      });
    }

    // Update user's security settings
    user.securitySettings = {
      ...user.securitySettings,
      sessionTimeout: timeout
    };

    await user.save();

    // Update current session
    req.session.cookie.maxAge = timeout * 1000;

    await createAuditLog({
      action: 'UPDATE_SESSION_TIMEOUT',
      adminId: user.id,
      targetId: user.id,
      targetType: 'USER',
      details: { timeout },
      ip: req.ip
    });

    res.json({ 
      message: 'Session timeout updated successfully',
      timeout
    });
  } catch (error) {
    logger.error('Error updating session timeout:', error);
    res.status(500).json({
      error: 'Failed to update session timeout',
      code: 'TIMEOUT_UPDATE_FAILED'
    });
  }
});

export default router;