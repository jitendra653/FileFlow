import { IUser } from '../models/user';

export interface SecurityScore {
  score: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  factors: SecurityFactor[];
  lastUpdated: Date;
}

interface SecurityFactor {
  name: string;
  impact: number;
  description: string;
  recommendation?: string;
}

export class SecurityScoreCalculator {
  private static readonly WEIGHTS = {
    failedLogins: 10,
    failedTwoFactor: 15,
    ipDiversity: 5,
    sessionAnomalies: 20,
    apiUsagePattern: 10,
    rateLimitHits: 15,
    timeOfAccess: 5,
    locationChanges: 10,
    concurrentSessions: 10
  };

  static calculateScore(metrics: {
    failedLoginAttempts: number;
    failedTwoFactorAttempts: number;
    uniqueIPs: number;
    sessionAnomalies: number;
    rateLimitExceeded: number;
    apiErrorRate: number;
    unusualAccessTimes: boolean;
    locationChanges: number;
    concurrentSessions: number;
  }): SecurityScore {
    const factors: SecurityFactor[] = [];
    let totalScore = 100;

    // Failed login attempts
    if (metrics.failedLoginAttempts > 0) {
      const impact = Math.min(metrics.failedLoginAttempts * this.WEIGHTS.failedLogins, 40);
      totalScore -= impact;
      factors.push({
        name: 'Failed Login Attempts',
        impact,
        description: `${metrics.failedLoginAttempts} failed login attempts detected`,
        recommendation: 'Consider implementing account lockout after multiple failed attempts'
      });
    }

    // Failed 2FA attempts
    if (metrics.failedTwoFactorAttempts > 0) {
      const impact = Math.min(metrics.failedTwoFactorAttempts * this.WEIGHTS.failedTwoFactor, 45);
      totalScore -= impact;
      factors.push({
        name: 'Failed 2FA Attempts',
        impact,
        description: `${metrics.failedTwoFactorAttempts} failed two-factor authentication attempts`,
        recommendation: 'Review 2FA logs and consider implementing temporary lockouts'
      });
    }

    // IP diversity
    if (metrics.uniqueIPs > 3) {
      const impact = Math.min((metrics.uniqueIPs - 3) * this.WEIGHTS.ipDiversity, 25);
      totalScore -= impact;
      factors.push({
        name: 'Multiple IP Addresses',
        impact,
        description: `Access from ${metrics.uniqueIPs} different IP addresses`,
        recommendation: 'Consider implementing IP whitelisting for sensitive operations'
      });
    }

    // Session anomalies
    if (metrics.sessionAnomalies > 0) {
      const impact = Math.min(metrics.sessionAnomalies * this.WEIGHTS.sessionAnomalies, 60);
      totalScore -= impact;
      factors.push({
        name: 'Session Anomalies',
        impact,
        description: `${metrics.sessionAnomalies} suspicious session activities detected`,
        recommendation: 'Review session management policies and implement stricter controls'
      });
    }

    // Rate limiting
    if (metrics.rateLimitExceeded > 0) {
      const impact = Math.min(metrics.rateLimitExceeded * this.WEIGHTS.rateLimitHits, 45);
      totalScore -= impact;
      factors.push({
        name: 'Rate Limit Exceeded',
        impact,
        description: `${metrics.rateLimitExceeded} rate limit violations detected`,
        recommendation: 'Implement progressive rate limiting and review API usage patterns'
      });
    }

    // API error rate
    if (metrics.apiErrorRate > 0.1) {
      const impact = Math.min(Math.floor(metrics.apiErrorRate * 100) * this.WEIGHTS.apiUsagePattern, 30);
      totalScore -= impact;
      factors.push({
        name: 'High API Error Rate',
        impact,
        description: `API error rate of ${(metrics.apiErrorRate * 100).toFixed(1)}%`,
        recommendation: 'Monitor for potential API abuse or implementation issues'
      });
    }

    // Unusual access times
    if (metrics.unusualAccessTimes) {
      const impact = this.WEIGHTS.timeOfAccess;
      totalScore -= impact;
      factors.push({
        name: 'Unusual Access Times',
        impact,
        description: 'Access detected during unusual hours',
        recommendation: 'Consider implementing time-based access restrictions'
      });
    }

    // Location changes
    if (metrics.locationChanges > 0) {
      const impact = Math.min(metrics.locationChanges * this.WEIGHTS.locationChanges, 30);
      totalScore -= impact;
      factors.push({
        name: 'Rapid Location Changes',
        impact,
        description: `${metrics.locationChanges} rapid location changes detected`,
        recommendation: 'Implement location-based authentication challenges'
      });
    }

    // Concurrent sessions
    if (metrics.concurrentSessions > 2) {
      const impact = Math.min((metrics.concurrentSessions - 2) * this.WEIGHTS.concurrentSessions, 30);
      totalScore -= impact;
      factors.push({
        name: 'Multiple Concurrent Sessions',
        impact,
        description: `${metrics.concurrentSessions} concurrent sessions detected`,
        recommendation: 'Consider limiting concurrent sessions per user'
      });
    }

    // Ensure score stays within bounds
    totalScore = Math.max(0, Math.min(100, totalScore));

    // Determine risk level
    let riskLevel: 'low' | 'medium' | 'high' | 'critical';
    if (totalScore >= 80) riskLevel = 'low';
    else if (totalScore >= 60) riskLevel = 'medium';
    else if (totalScore >= 40) riskLevel = 'high';
    else riskLevel = 'critical';

    return {
      score: totalScore,
      riskLevel,
      factors,
      lastUpdated: new Date()
    };
  }
}