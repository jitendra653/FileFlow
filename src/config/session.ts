import session from 'express-session';
import MongoStore from 'connect-mongo';
import { v4 as uuidv4 } from 'uuid';
import { Request, Response, NextFunction } from 'express';
import { IUser } from '../models/user';
import { securityMonitor } from '../utils/securityMonitor';

declare module 'express-session' {
  interface SessionData {
    userId?: string;
    userRole?: string;
    lastActivity?: Date;
    deviceInfo?: {
      userAgent: string;
      ip: string;
      fingerprint?: string;
    };
    failedValidations?: number;
    tempTwoFactorSecret?: string;
    tempBackupCodes?: string[];
  }
}

export interface SessionConfig {
  secret: string;
  name: string;
  mongoUrl: string;
  ttl: number; // Time To Live in seconds
  maxInactivity: number; // Maximum inactivity time in seconds
  maxFailedValidations?: number; // Maximum number of failed session validations before requiring re-login
  allowDeviceChange?: boolean; // Whether to allow sessions to continue when device info changes
}

export const configureSession = (config: SessionConfig) => {
  return session({
    secret: config.secret,
    name: config.name, // Custom cookie name
    store: MongoStore.create({
      mongoUrl: config.mongoUrl,
      ttl: config.ttl, // Session TTL in seconds
      crypto: {
        secret: config.secret // Encrypt session data
      },
      autoRemove: 'native', // Enable automatic removal of expired sessions
      touchAfter: 24 * 3600 // Only update session if 24 hours have passed
    }),
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      maxAge: config.ttl * 1000, // Convert to milliseconds
      sameSite: 'strict'
    },
    genid: () => uuidv4(), // Generate unique session IDs
    rolling: true, // Reset maxAge on every response
    resave: false,
    saveUninitialized: false,
  // allowDeviceChange removed: not a valid SessionOptions property
  });
};

// Track active sessions per user
export class SessionManager {
  private static sessions: Map<string, Set<string>> = new Map();

  static async addSession(userId: string, sessionId: string): Promise<void> {
    const userSessions = this.sessions.get(userId) || new Set();
    
    // Track if user has too many concurrent sessions
    if (userSessions.size >= 5) { // Arbitrary limit of 5 concurrent sessions
      await securityMonitor.trackSessionAnomaly(
        userId,
        'concurrent',
        { 
          sessionCount: userSessions.size + 1,
          maxAllowed: 5
        }
      );
    }
    
    userSessions.add(sessionId);
    this.sessions.set(userId, userSessions);
  }

  static removeSession(userId: string, sessionId: string): void {
    const userSessions = this.sessions.get(userId);
    if (userSessions) {
      userSessions.delete(sessionId);
      if (userSessions.size === 0) {
        this.sessions.delete(userId);
      }
    }
  }

  static getUserSessions(userId: string): string[] {
    return Array.from(this.sessions.get(userId) || []);
  }

  static getAllActiveSessions(): Map<string, Set<string>> {
    return new Map(this.sessions);
  }

  static async terminateUserSessions(userId: string, exceptSessionId?: string): Promise<void> {
    const userSessions = this.sessions.get(userId);
    if (userSessions) {
      for (const sessionId of userSessions) {
        if (sessionId !== exceptSessionId) {
          // Track session termination in security monitor
          securityMonitor.trackSessionTermination(userId, sessionId);
          
          // Delete session from store
          await new Promise<void>((resolve) => {
            const sessionStore = session.Store.prototype;
            sessionStore.destroy(sessionId, (err) => {
              if (err) {
                console.error(`Error destroying session ${sessionId}:`, err);
                securityMonitor.trackSessionError(userId, sessionId, 'termination_failed');
              }
              resolve();
            });
          });
          userSessions.delete(sessionId);
        }
      }
      if (userSessions.size === 0) {
        this.sessions.delete(userId);
      }
    }
  }
}

// Session validation middleware
export const validateSession = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.session.userId) {
      return next();
    }

    // Check session age
    const lastActivity = req.session.lastActivity ? new Date(req.session.lastActivity) : new Date();
    const inactivityTime = (new Date().getTime() - lastActivity.getTime()) / 1000;

    if (inactivityTime > (req.session as any).maxInactivity) {
      // Track session expiration
      await securityMonitor.trackSessionAnomaly(
        req.session.userId,
        'expired',
        { inactivityTime, maxInactivity: (req.session as any).maxInactivity }
      );

      // Session expired due to inactivity
      await new Promise<void>((resolve) => {
        req.session.destroy((err) => {
          if (err) {
            console.error('Error destroying session:', err);
            securityMonitor.trackSessionError(req.session.userId, req.sessionID, 'destroy_failed');
          }
          resolve();
        });
      });
      return res.status(440).json({
        error: 'Session expired',
        code: 'SESSION_EXPIRED'
      });
    }

    // Get current device info with fingerprint
    const currentDeviceInfo = {
      userAgent: req.headers['user-agent'] || 'unknown',
      ip: req.ip || req.socket.remoteAddress || 'unknown',
      fingerprint: req.headers['x-device-fingerprint'] as string || undefined
    };

    // Initialize failed validations counter
    if (typeof req.session.failedValidations !== 'number') {
      req.session.failedValidations = 0;
    }

    if (req.session.deviceInfo) {
      let hasValidationFailures = false;

      // Check device fingerprint if available
      if (req.session.deviceInfo.fingerprint && 
          currentDeviceInfo.fingerprint &&
          req.session.deviceInfo.fingerprint !== currentDeviceInfo.fingerprint) {
        
        await securityMonitor.trackSessionAnomaly(
          req.session.userId,
          'invalid',
          { 
            reason: 'device_fingerprint_mismatch',
            stored: req.session.deviceInfo.fingerprint,
            current: currentDeviceInfo.fingerprint
          }
        );
        hasValidationFailures = true;
      }

      // Check user agent
      if (req.session.deviceInfo.userAgent !== currentDeviceInfo.userAgent) {
        await securityMonitor.trackSessionAnomaly(
          req.session.userId,
          'invalid',
          { 
            reason: 'user_agent_mismatch',
            stored: req.session.deviceInfo.userAgent,
            current: currentDeviceInfo.userAgent
          }
        );
        hasValidationFailures = true;
      }

      // Check IP changes
      if (req.session.deviceInfo.ip !== currentDeviceInfo.ip) {
        await securityMonitor.trackSessionAnomaly(
          req.session.userId,
          'invalid',
          { 
            reason: 'ip_mismatch',
            stored: req.session.deviceInfo.ip,
            current: currentDeviceInfo.ip
          }
        );
        hasValidationFailures = true;
      }

      // Increment failed validations if any validation failed
      if (hasValidationFailures) {
        req.session.failedValidations++;
        
        // Check if max failed validations exceeded
        if (req.session.failedValidations >= ((req.session as any).maxFailedValidations || 3)) {
          await new Promise<void>((resolve) => {
            req.session.destroy((err) => {
              if (err) {
                console.error('Error destroying session:', err);
                securityMonitor.trackSessionError(req.session.userId, req.sessionID, 'destroy_failed');
              }
              resolve();
            });
          });
          return res.status(440).json({
            error: 'Session invalidated due to multiple validation failures',
            code: 'SESSION_VALIDATION_FAILED',
            detail: `Exceeded maximum validation failures (${req.session.failedValidations})`
          });
        }
      }
    }

    // Update device info and last activity
    req.session.deviceInfo = currentDeviceInfo;
    req.session.lastActivity = new Date();

    next();
  } catch (error) {
    console.error('Session validation error:', error);
    if (req.session?.userId) {
      securityMonitor.trackSessionError(req.session.userId, req.sessionID, 'validation_error');
    }
    next(error);
  }
};