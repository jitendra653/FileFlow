import { EventEmitter } from 'events';
import { promClient, Counter, Histogram, Gauge } from '../utils/metrics';
import logger from '../utils/logger';
import { createAuditLog } from '../utils/auditLogger';
import { IUser } from '../models/user';
import { SecurityScore, SecurityScoreCalculator } from './securityScore';

interface SecurityAlert {
  type: 'warning' | 'critical';
  source: string;
  message: string;
  details: any;
  timestamp: Date;
  threatLevel?: number;
}

interface SecurityMetrics {
  failedLoginAttempts: Map<string, number>;
  failedTwoFactorAttempts: Map<string, number>;
  ipBlocklist: Set<string>;
  lastReset: Date;
  userMetrics: Map<string, UserSecurityMetrics>;
}

interface UserSecurityMetrics {
  userId: string;
  failedLoginAttempts: number;
  failedTwoFactorAttempts: number;
  uniqueIPs: Set<string>;
  sessionAnomalies: number;
  rateLimitExceeded: number;
  apiErrorCount: number;
  apiCallCount: number;
  lastAccessTime: Date;
  knownLocations: Set<string>;
  locationChanges: number;
  activeSessions: Set<string>;
  securityScore?: SecurityScore;
}

class SecurityMonitor extends EventEmitter {
  private static instance: SecurityMonitor;
  private alerts: SecurityAlert[] = [];
  private metrics: SecurityMetrics = {
    failedLoginAttempts: new Map(),
    failedTwoFactorAttempts: new Map(),
    ipBlocklist: new Set(),
    lastReset: new Date(),
    userMetrics: new Map()
  };

  // Prometheus metrics
  private securityIncidentCounter = new Counter({
    name: 'app_security_incidents_total',
    help: 'Total number of security incidents by type',
    labelNames: ['type', 'source', 'severity']
  });

  private loginAttemptsHistogram = new Histogram({
    name: 'app_login_attempts_duration_seconds',
    help: 'Duration of login attempts',
    labelNames: ['status', 'user_id'],
    buckets: [0.1, 0.5, 1, 2, 5]
  });

  private twoFactorAttemptsCounter = new Counter({
    name: 'app_two_factor_attempts_total',
    help: 'Total number of 2FA attempts',
    labelNames: ['status', 'user_id']
  });

  private ipBlocklistGauge = new Gauge({
    name: 'app_ip_blocklist_total',
    help: 'Total number of blocked IPs'
  });

  private securityScoreGauge = new Gauge({
    name: 'app_user_security_score',
    help: 'Security score for each user',
    labelNames: ['user_id', 'risk_level']
  });

  private apiUsageHistogram = new Histogram({
    name: 'app_api_usage_pattern',
    help: 'API usage patterns by user',
    labelNames: ['user_id', 'status'],
    buckets: [10, 50, 100, 500, 1000]
  });

  private locationChangesGauge = new Gauge({
    name: 'app_location_changes',
    help: 'Number of location changes per user',
    labelNames: ['user_id']
  });

  private concurrentSessionsGauge = new Gauge({
    name: 'app_concurrent_sessions',
    help: 'Number of concurrent sessions per user',
    labelNames: ['user_id']
  });

  private constructor() {
    super();
    this.startMetricsReset();
    this.on('alert', (alert: SecurityAlert) => {
      this.alerts.push(alert);
      // Keep only the last 100 alerts to avoid memory bloat
      if (this.alerts.length > 100) this.alerts.shift();
    });
  }
  getAllAlerts(): SecurityAlert[] {
    return this.alerts;
  }

  static getInstance(): SecurityMonitor {
    if (!SecurityMonitor.instance) {
      SecurityMonitor.instance = new SecurityMonitor();
    }
    return SecurityMonitor.instance;
  }

  private startMetricsReset(): void {
    // Reset metrics every 24 hours
    setInterval(() => {
      this.metrics.failedLoginAttempts.clear();
      this.metrics.failedTwoFactorAttempts.clear();
      this.metrics.lastReset = new Date();
      logger.info('Security metrics reset');
    }, 24 * 60 * 60 * 1000);
  }

  private initializeUserMetrics(userId: string): UserSecurityMetrics {
    const userMetrics: UserSecurityMetrics = {
      userId,
      failedLoginAttempts: 0,
      failedTwoFactorAttempts: 0,
      uniqueIPs: new Set(),
      sessionAnomalies: 0,
      rateLimitExceeded: 0,
      apiErrorCount: 0,
      apiCallCount: 0,
      lastAccessTime: new Date(),
      knownLocations: new Set(),
      locationChanges: 0,
      activeSessions: new Set()
    };
    this.metrics.userMetrics.set(userId, userMetrics);
    return userMetrics;
  }

  private updateSecurityScore(userId: string): void {
    const metrics = this.metrics.userMetrics.get(userId);
    if (!metrics) return;

    const score = SecurityScoreCalculator.calculateScore({
      failedLoginAttempts: metrics.failedLoginAttempts,
      failedTwoFactorAttempts: metrics.failedTwoFactorAttempts,
      uniqueIPs: metrics.uniqueIPs.size,
      sessionAnomalies: metrics.sessionAnomalies,
      rateLimitExceeded: metrics.rateLimitExceeded,
      apiErrorRate: metrics.apiCallCount > 0 ? metrics.apiErrorCount / metrics.apiCallCount : 0,
      unusualAccessTimes: this.isUnusualAccessTime(metrics.lastAccessTime),
      locationChanges: metrics.locationChanges,
      concurrentSessions: metrics.activeSessions.size
    });

    metrics.securityScore = score;
    this.securityScoreGauge
      .labels(userId, score.riskLevel)
      .set(score.score);

    // Emit high-risk alerts
    if (score.riskLevel === 'critical' || score.riskLevel === 'high') {
      const alert: SecurityAlert = {
        type: 'critical',
        source: 'security_score',
        message: `High security risk detected for user: ${score.riskLevel.toUpperCase()}`,
        details: { userId, score },
        timestamp: new Date(),
        threatLevel: 100 - score.score
      };
      this.emit('alert', alert);
    }
  }

  private isUnusualAccessTime(accessTime: Date): boolean {
    const hour = accessTime.getHours();
    // Consider access between 11 PM and 5 AM as unusual
    return hour >= 23 || hour <= 5;
  }

  async trackLoginAttempt(
    success: boolean,
    ip: string,
    email: string,
    duration: number,
    userId?: string
  ): Promise<void> {
    const status = success ? 'success' : 'failure';
    if (userId) {
      this.loginAttemptsHistogram.labels(status, userId).observe(duration);
      
      const metrics = this.metrics.userMetrics.get(userId) || this.initializeUserMetrics(userId);
      metrics.uniqueIPs.add(ip);
      metrics.lastAccessTime = new Date();

      if (!success) {
        metrics.failedLoginAttempts++;
      }

      this.updateSecurityScore(userId);
    } else {
      this.loginAttemptsHistogram.labels(status, 'unknown').observe(duration);
    }

    if (!success) {
      const attempts = (this.metrics.failedLoginAttempts.get(ip) || 0) + 1;
      this.metrics.failedLoginAttempts.set(ip, attempts);
      
      if (attempts >= 5) {
        this.metrics.ipBlocklist.add(ip);
        this.ipBlocklistGauge.set(this.metrics.ipBlocklist.size);
        
        const alert: SecurityAlert = {
          type: 'warning',
          source: 'login',
          message: 'Multiple failed login attempts detected',
          details: { ip, email, attempts, userId },
          timestamp: new Date(),
          threatLevel: Math.min(attempts * 10, 100)
        };
        
        this.emit('alert', alert);
        await this.logSecurityEvent('MULTIPLE_FAILED_LOGINS', { ip, email, attempts, userId });
      }
    }
  }

  async trackTwoFactorAttempt(
    success: boolean,
    user: IUser,
    ip: string
  ): Promise<void> {
    const status = success ? 'success' : 'failure';
    this.twoFactorAttemptsCounter.labels(status, user.id).inc();

    const metrics = this.metrics.userMetrics.get(user.id) || this.initializeUserMetrics(user.id);
    metrics.uniqueIPs.add(ip);
    metrics.lastAccessTime = new Date();

    if (!success) {
      const attempts = (this.metrics.failedTwoFactorAttempts.get(ip) || 0) + 1;
      this.metrics.failedTwoFactorAttempts.set(ip, attempts);
      metrics.failedTwoFactorAttempts++;

      this.updateSecurityScore(user.id);

      if (attempts >= 3) {
        const alert: SecurityAlert = {
          type: 'critical',
          source: '2fa',
          message: 'Multiple failed 2FA attempts detected',
          details: { userId: user.id, ip, attempts },
          timestamp: new Date(),
          threatLevel: Math.min(attempts * 20, 100)
        };

        this.emit('alert', alert);
        await this.logSecurityEvent('MULTIPLE_FAILED_2FA', { 
          userId: user.id, 
          ip, 
          attempts 
        });
      }
    }
  }

  async trackUnauthorizedIPAccess(ip: string, userId: string): Promise<void> {
    this.securityIncidentCounter.labels('unauthorized_ip', 'ip_whitelist').inc();
    
    const alert: SecurityAlert = {
      type: 'warning',
      source: 'ip_whitelist',
      message: 'Unauthorized IP access attempt',
      details: { ip, userId },
      timestamp: new Date()
    };

    this.emit('alert', alert);
    await this.logSecurityEvent('UNAUTHORIZED_IP_ACCESS', { ip, userId });
  }

  async trackSessionAnomaly(
    userId: string,
    type: 'concurrent' | 'expired' | 'invalid',
    details: any
  ): Promise<void> {
    this.securityIncidentCounter.labels('session_anomaly', type).inc();

    const alert: SecurityAlert = {
      type: 'warning',
      source: 'session',
      message: `Session anomaly detected: ${type}`,
      details: { userId, ...details },
      timestamp: new Date()
    };

    this.emit('alert', alert);
    await this.logSecurityEvent('SESSION_ANOMALY', { 
      userId, 
      type, 
      details 
    });
  }

  isIPBlocked(ip: string): boolean {
    return this.metrics.ipBlocklist.has(ip);
  }

  getMetrics(): SecurityMetrics {
    return {
      ...this.metrics,
      lastReset: new Date(this.metrics.lastReset)
    };
  }

  private async logSecurityEvent(
    action: string,
    details: any
  ): Promise<void> {
    try {
      await createAuditLog({
        action,
        adminId: details.userId || 'system',
        targetId: details.userId || 'system',
        targetType: 'SECURITY',
        details,
        ip: details.ip || 'system'
      });
    } catch (error) {
      logger.error('Failed to log security event:', error);
    }
  }

  async trackSessionTermination(userId: string, sessionId: string): Promise<void> {
    this.securityIncidentCounter.labels('session_termination', 'session').inc();
    
    await this.logSecurityEvent('SESSION_TERMINATED', { 
      userId,
      sessionId,
      type: 'termination'
    });
  }

  async trackSessionError(userId: string, sessionId: string, errorType: string): Promise<void> {
    this.securityIncidentCounter.labels('session_error', errorType, 'warning').inc();
    
    const metrics = this.metrics.userMetrics.get(userId);
    if (metrics) {
      metrics.sessionAnomalies++;
      this.updateSecurityScore(userId);
    }
    
    const alert: SecurityAlert = {
      type: 'warning',
      source: 'session',
      message: `Session error occurred: ${errorType}`,
      details: { userId, sessionId, errorType },
      timestamp: new Date(),
      threatLevel: 60
    };

    this.emit('alert', alert);
    await this.logSecurityEvent('SESSION_ERROR', { 
      userId,
      sessionId,
      errorType 
    });
  }

  async trackAPIUsage(
    userId: string,
    endpoint: string,
    status: number,
    duration: number
  ): Promise<void> {
    const metrics = this.metrics.userMetrics.get(userId) || this.initializeUserMetrics(userId);
    metrics.apiCallCount++;
    
    const isError = status >= 400;
    if (isError) {
      metrics.apiErrorCount++;
    }

    this.apiUsageHistogram
      .labels(userId, isError ? 'error' : 'success')
      .observe(duration);

    if (metrics.apiErrorCount > 50 || metrics.apiCallCount > 1000) {
      this.updateSecurityScore(userId);
    }
  }

  async trackLocationChange(
    userId: string,
    ip: string,
    location: string
  ): Promise<void> {
    const metrics = this.metrics.userMetrics.get(userId) || this.initializeUserMetrics(userId);
    
    if (!metrics.knownLocations.has(location)) {
      metrics.knownLocations.add(location);
      metrics.locationChanges++;
      this.locationChangesGauge.labels(userId).set(metrics.locationChanges);

      // Check for rapid location changes (more than 2 in an hour)
      if (metrics.locationChanges > 2) {
        const alert: SecurityAlert = {
          type: 'warning',
          source: 'location',
          message: 'Rapid location changes detected',
          details: { userId, ip, location, changes: metrics.locationChanges },
          timestamp: new Date(),
          threatLevel: Math.min(metrics.locationChanges * 15, 90)
        };
        this.emit('alert', alert);
        await this.logSecurityEvent('SUSPICIOUS_LOCATION_CHANGES', {
          userId,
          ip,
          location,
          changes: metrics.locationChanges
        });
      }

      this.updateSecurityScore(userId);
    }
  }

  async trackSessionActivity(
    userId: string,
    sessionId: string,
    action: 'create' | 'terminate'
  ): Promise<void> {
    const metrics = this.metrics.userMetrics.get(userId) || this.initializeUserMetrics(userId);

    if (action === 'create') {
      metrics.activeSessions.add(sessionId);
    } else {
      metrics.activeSessions.delete(sessionId);
    }

    this.concurrentSessionsGauge
      .labels(userId)
      .set(metrics.activeSessions.size);

    // Alert on high number of concurrent sessions
    if (metrics.activeSessions.size > 3) {
      const alert: SecurityAlert = {
        type: 'warning',
        source: 'session',
        message: 'High number of concurrent sessions',
        details: { userId, sessionCount: metrics.activeSessions.size },
        timestamp: new Date(),
        threatLevel: Math.min(metrics.activeSessions.size * 20, 80)
      };
      this.emit('alert', alert);
    }

    this.updateSecurityScore(userId);
  }

  getSecurityMetrics(userId: string): SecurityScore | undefined {
    const metrics = this.metrics.userMetrics.get(userId);
    return metrics?.securityScore;
  }

  clearUserMetrics(userId: string): void {
    this.metrics.userMetrics.delete(userId);
    this.securityScoreGauge.remove(userId);
    this.concurrentSessionsGauge.remove(userId);
    this.locationChangesGauge.remove(userId);
  }

  async getAllSecurityScores(): Promise<Record<string, SecurityScore>> {
    const scores: Record<string, SecurityScore> = {};
    for (const [userId, metrics] of this.metrics.userMetrics.entries()) {
      if (metrics.securityScore) {
        scores[userId] = metrics.securityScore;
      }
    }
    return scores;
  }

  getBlockedIPs(): string[] {
    return Array.from(this.metrics.ipBlocklist);
  }

  async blockIP(ip: string): Promise<void> {
    if (!this.metrics.ipBlocklist.has(ip)) {
      this.metrics.ipBlocklist.add(ip);
      this.ipBlocklistGauge.set(this.metrics.ipBlocklist.size);
      await this.logSecurityEvent('IP_BLOCKED', { ip });
    }
  }

  async unblockIP(ip: string): Promise<void> {
    if (this.metrics.ipBlocklist.has(ip)) {
      this.metrics.ipBlocklist.delete(ip);
      this.ipBlocklistGauge.set(this.metrics.ipBlocklist.size);
      await this.logSecurityEvent('IP_UNBLOCKED', { ip });
    }
  }

  async getActiveThreats(): Promise<SecurityAlert[]> {
    const threats: SecurityAlert[] = [];
    for (const [userId, metrics] of this.metrics.userMetrics.entries()) {
      if (metrics.securityScore && metrics.securityScore.riskLevel === 'critical') {
        threats.push({
          type: 'critical',
          source: 'security_score',
          message: 'Critical security risk detected',
          details: { userId, score: metrics.securityScore },
          timestamp: new Date(),
          threatLevel: 100 - metrics.securityScore.score
        });
      }
    }
    return threats;
  }

  async getSecurityAuditLog(start: number, limit: number): Promise<any[]> {
    // This should be implemented to fetch from your audit log storage
    // For now, returning empty array as placeholder
    return [];
  }

  async getActiveSessions(): Promise<Record<string, string[]>> {
    const sessions: Record<string, string[]> = {};
    for (const [userId, metrics] of this.metrics.userMetrics.entries()) {
      if (metrics.activeSessions.size > 0) {
        sessions[userId] = Array.from(metrics.activeSessions);
      }
    }
    return sessions;
  }

  async terminateUserSessions(userId: string, reason: string): Promise<void> {
    const metrics = this.metrics.userMetrics.get(userId);
    if (metrics) {
      for (const sessionId of metrics.activeSessions) {
        await this.trackSessionTermination(userId, sessionId);
      }
      metrics.activeSessions.clear();
      this.concurrentSessionsGauge.labels(userId).set(0);
      await this.logSecurityEvent('SESSIONS_TERMINATED', { userId, reason });
    }
  }

  async getRateLimitStatus(): Promise<Record<string, any>> {
    const status: Record<string, any> = {};
    for (const [userId, metrics] of this.metrics.userMetrics.entries()) {
      if (metrics.rateLimitExceeded > 0) {
        status[userId] = {
          rateLimitExceeded: metrics.rateLimitExceeded,
          apiErrorRate: metrics.apiCallCount > 0 ? 
            metrics.apiErrorCount / metrics.apiCallCount : 0,
          securityScore: metrics.securityScore
        };
      }
    }
    return status;
  }
}

export const securityMonitor = SecurityMonitor.getInstance();