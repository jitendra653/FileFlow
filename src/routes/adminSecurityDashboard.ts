// Extend Express session type for isAdmin
declare module 'express-session' {
  interface SessionData {
    isAdmin?: boolean;
  }
}

import path from 'path';
import { Router } from 'express';
import { requireAdmin } from '../middleware/adminAuth';
import {securityMonitor } from '../utils/securityMonitor';
import { register } from '../utils/metrics';
import { validationResult } from 'express-validator';
import { body } from 'express-validator';
import { AppError } from '../middleware/errorHandler';

const router = Router();


// Get all security alerts (warnings and critical)
router.get('/alerts', requireAdmin, async (req, res) => {
  const alerts = securityMonitor.getAllAlerts();
  res.json({ alerts });
});

// Get rate limit status
router.get('/rate-limits', requireAdmin, async (req, res) => {
  const rateLimits = await securityMonitor.getRateLimitStatus();
  res.json({ rateLimits });
})

// Get overall security metrics
router.get('/metrics', requireAdmin, async (req, res) => {
  const metrics = await register.metrics();
  res.set('Content-Type', register.contentType);
  res.end(metrics);
});

// Get security scores for all users
router.get('/scores', requireAdmin, async (req, res) => {
  const metrics = await securityMonitor.getAllSecurityScores();
  res.json({ metrics });
});

// Get security metrics for a specific user
router.get('/users/:userId', requireAdmin, async (req, res) => {
  const { userId } = req.params;
  const metrics = securityMonitor.getSecurityMetrics(userId);
  
  if (!metrics) {
    throw AppError.notFound('Security metrics not found for user');
  }
  
  res.json({ metrics });
});

// Get all active threats
router.get('/threats', requireAdmin, async (req, res) => {
  const threats = await securityMonitor.getActiveThreats();
  res.json({ threats });
});

// Get blocked IPs
router.get('/blocked-ips', requireAdmin, async (req, res) => {
  const blockedIPs = securityMonitor.getBlockedIPs();
  res.json({ blockedIPs });
});

// Manual IP block/unblock
router.post(
  '/ip-block',
  requireAdmin,
  body('ip').isIP(),
  body('action').isIn(['block', 'unblock']),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const { ip, action } = req.body;
    if (action === 'block') {
      await securityMonitor.blockIP(ip);
    } else {
      await securityMonitor.unblockIP(ip);
    }
    res.json({ success: true });
  }
);

// Get security audit log
router.get('/audit-log', requireAdmin, async (req, res) => {
  const { start = 0, limit = 50 } = req.query;
  const auditLog = await securityMonitor.getSecurityAuditLog(
    Number(start),
    Number(limit)
  );
  res.json({ auditLog });
});

// Get active sessions overview
router.get('/sessions', requireAdmin, async (req, res) => {
  const sessions = await securityMonitor.getActiveSessions();
  res.json({ sessions });
});

// Force logout user sessions
router.post(
  '/terminate-sessions',
  requireAdmin,
  body('userId').isString(),
  body('reason').isString(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const { userId, reason } = req.body;
    await securityMonitor.terminateUserSessions(userId, reason);
    res.json({ success: true });
  }
);


export default router;
