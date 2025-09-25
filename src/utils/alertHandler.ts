import { securityMonitor } from './securityMonitor';
import logger from './logger';
import { createAuditLog } from './auditLogger';

class AlertHandler {
  private static instance: AlertHandler;
  private alertThrottles: Map<string, Date> = new Map();
  private readonly throttleWindow = 5 * 60 * 1000; // 5 minutes

  private constructor() {
    this.initializeSecurityAlerts();
  }

  static getInstance(): AlertHandler {
    if (!AlertHandler.instance) {
      AlertHandler.instance = new AlertHandler();
    }
    return AlertHandler.instance;
  }

  private initializeSecurityAlerts(): void {
    securityMonitor.on('alert', async (alert) => {
      try {
        const alertKey = `${alert.source}:${alert.type}:${JSON.stringify(alert.details)}`;
        
        // Check if alert is throttled
        const lastAlert = this.alertThrottles.get(alertKey);
        if (lastAlert && (new Date().getTime() - lastAlert.getTime()) < this.throttleWindow) {
          return;
        }

        // Update throttle timestamp
        this.alertThrottles.set(alertKey, new Date());

        // Log the alert
        if (alert.type === 'critical') {
          logger.error('SECURITY ALERT:', {
            source: alert.source,
            message: alert.message,
            details: alert.details,
            timestamp: alert.timestamp
          });
        } else {
          logger.warn('Security Warning:', {
            source: alert.source,
            message: alert.message,
            details: alert.details,
            timestamp: alert.timestamp
          });
        }

        // Create audit log
        await createAuditLog({
          action: 'SECURITY_ALERT',
          adminId: 'system',
          targetId: alert.details.userId || 'system',
          targetType: 'SECURITY',
          details: {
            alertType: alert.type,
            source: alert.source,
            message: alert.message,
            ...alert.details
          },
          ip: alert.details.ip || 'system'
        });

        // Additional alert actions based on type and source
        await this.handleSpecificAlert(alert);

      } catch (error) {
        logger.error('Error handling security alert:', error);
      }
    });
  }

  private async handleSpecificAlert(alert: any): Promise<void> {
    switch (`${alert.source}:${alert.type}`) {
      case 'login:critical':
        // Potential brute force attack
        if (alert.details.attempts >= 10) {
          await this.handleBruteForceAttempt(alert);
        }
        break;

      case '2fa:critical':
        // Multiple 2FA failures
        if (alert.details.attempts >= 5) {
          await this.handleMultiple2FAFailures(alert);
        }
        break;

      case 'session:critical':
        // Session anomalies
        if (alert.details.type === 'concurrent') {
          await this.handleConcurrentSessionAnomaly(alert);
        }
        break;

      case 'ip_whitelist:warning':
        // Unauthorized IP access attempts
        await this.handleUnauthorizedIPAccess(alert);
        break;
    }
  }

  private async handleBruteForceAttempt(alert: any): Promise<void> {
    logger.error('Potential brute force attack detected:', {
      ip: alert.details.ip,
      email: alert.details.email,
      attempts: alert.details.attempts
    });

    // Could integrate with firewall/WAF here
    // Could send notifications to security team
  }

  private async handleMultiple2FAFailures(alert: any): Promise<void> {
    logger.error('Multiple 2FA failures detected:', {
      userId: alert.details.userId,
      ip: alert.details.ip,
      attempts: alert.details.attempts
    });

    // Could temporarily disable 2FA and require reset
    // Could notify user via alternative channel
  }

  private async handleConcurrentSessionAnomaly(alert: any): Promise<void> {
    logger.error('Suspicious concurrent sessions detected:', {
      userId: alert.details.userId,
      sessionCount: alert.details.sessionCount,
      locations: alert.details.locations
    });

    // Could force logout of all sessions
    // Could require additional verification
  }

  private async handleUnauthorizedIPAccess(alert: any): Promise<void> {
    logger.warn('Unauthorized IP access attempt:', {
      userId: alert.details.userId,
      ip: alert.details.ip,
      allowedIPs: alert.details.allowedIPs
    });

    // Could add IP to temporary block list
    // Could notify admin of access attempt
  }
}

export const alertHandler = AlertHandler.getInstance();