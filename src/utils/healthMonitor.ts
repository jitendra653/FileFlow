import { EventEmitter } from 'events';
import os from 'os';
import { performance } from 'perf_hooks';
import logger from './logger';

interface HealthMetrics {
  timestamp: number;
  cpu: {
    usage: number;
    loadAvg: number[];
    temperature?: number;
  };
  memory: {
    total: number;
    used: number;
    free: number;
    heapUsed: number;
    heapTotal: number;
  };
  disk: {
    total: number;
    used: number;
    free: number;
  };
  network: {
    connections: number;
    bytesIn: number;
    bytesOut: number;
    errorRate: number;
  };
  application: {
    uptime: number;
    responseTime: number;
    errorRate: number;
    activeRequests: number;
    eventLoopLag: number;
  };
  alerts: Alert[];
}

interface Alert {
  type: 'warning' | 'critical';
  metric: string;
  message: string;
  value: number;
  threshold: number;
  timestamp: number;
}

interface ThresholdConfig {
  cpu: {
    usage: number;
    loadAvg: number;
  };
  memory: {
    usage: number;
    heap: number;
  };
  disk: {
    usage: number;
  };
  application: {
    errorRate: number;
    responseTime: number;
    eventLoopLag: number;
  };
}

class HealthMonitor extends EventEmitter {
  private metrics: HealthMetrics;
  private alertHistory: Alert[] = [];
  private checkInterval: NodeJS.Timeout;
  private metricsHistory: HealthMetrics[] = [];
  private readonly historyLimit = 1440; // Store 24 hours of metrics at 1-minute intervals
  private thresholds: ThresholdConfig = {
    cpu: {
      usage: 80, // 80% CPU usage
      loadAvg: 5  // Load average above 5
    },
    memory: {
      usage: 85, // 85% memory usage
      heap: 80   // 80% heap usage
    },
    disk: {
      usage: 90  // 90% disk usage
    },
    application: {
      errorRate: 5,    // 5% error rate
      responseTime: 1000, // 1 second response time
      eventLoopLag: 100  // 100ms event loop lag
    }
  };

  constructor() {
    super();
    this.metrics = this.initializeMetrics();
    this.startMonitoring();
  }

  private initializeMetrics(): HealthMetrics {
    return {
      timestamp: Date.now(),
      cpu: {
        usage: 0,
        loadAvg: os.loadavg(),
      },
      memory: {
        total: os.totalmem(),
        used: 0,
        free: os.freemem(),
        heapUsed: process.memoryUsage().heapUsed,
        heapTotal: process.memoryUsage().heapTotal
      },
      disk: {
        total: 0,
        used: 0,
        free: 0
      },
      network: {
        connections: 0,
        bytesIn: 0,
        bytesOut: 0,
        errorRate: 0
      },
      application: {
        uptime: process.uptime(),
        responseTime: 0,
        errorRate: 0,
        activeRequests: 0,
        eventLoopLag: 0
      },
      alerts: []
    };
  }

  private startMonitoring() {
    this.checkInterval = setInterval(() => this.checkHealth(), 60000); // Check every minute
  }

  private async checkHealth() {
    try {
      const currentMetrics = await this.gatherMetrics();
      this.analyzeMetrics(currentMetrics);
      this.updateMetricsHistory(currentMetrics);
      this.emit('metrics', currentMetrics);
    } catch (error) {
      logger.error('Error checking system health:', error);
    }
  }

  private async gatherMetrics(): Promise<HealthMetrics> {
    const metrics = this.initializeMetrics();
    
    // CPU Usage
    const startUsage = process.cpuUsage();
    await new Promise(resolve => setTimeout(resolve, 100));
    const endUsage = process.cpuUsage(startUsage);
    const totalUsage = (endUsage.user + endUsage.system) / 1000000; // Convert to seconds
    metrics.cpu.usage = (totalUsage * 100) / (os.cpus().length);

    // Memory
    const memUsed = os.totalmem() - os.freemem();
    metrics.memory.used = memUsed;
    metrics.memory.free = os.freemem();

    // Event Loop Lag
    metrics.application.eventLoopLag = await this.measureEventLoopLag();

    // Active Requests
  // metrics.application.activeRequests = process._getActiveRequests().length; // Not available in Node typings, skip or use safe fallback
  metrics.application.activeRequests = 0; // Placeholder, Node.js does not expose this in typings

    return metrics;
  }

  private async measureEventLoopLag(): Promise<number> {
    const start = performance.now();
    return new Promise(resolve => {
      setImmediate(() => {
        resolve(performance.now() - start);
      });
    });
  }

  private analyzeMetrics(metrics: HealthMetrics) {
    const alerts: Alert[] = [];

    // CPU Checks
    if (metrics.cpu.usage > this.thresholds.cpu.usage) {
      alerts.push({
        type: metrics.cpu.usage > 90 ? 'critical' : 'warning',
        metric: 'cpu_usage',
        message: `High CPU usage: ${metrics.cpu.usage.toFixed(2)}%`,
        value: metrics.cpu.usage,
        threshold: this.thresholds.cpu.usage,
        timestamp: Date.now()
      });
    }

    // Memory Checks
    const memoryUsagePercent = (metrics.memory.used / metrics.memory.total) * 100;
    if (memoryUsagePercent > this.thresholds.memory.usage) {
      alerts.push({
        type: memoryUsagePercent > 95 ? 'critical' : 'warning',
        metric: 'memory_usage',
        message: `High memory usage: ${memoryUsagePercent.toFixed(2)}%`,
        value: memoryUsagePercent,
        threshold: this.thresholds.memory.usage,
        timestamp: Date.now()
      });
    }

    // Event Loop Lag Check
    if (metrics.application.eventLoopLag > this.thresholds.application.eventLoopLag) {
      alerts.push({
        type: 'warning',
        metric: 'event_loop_lag',
        message: `High event loop lag: ${metrics.application.eventLoopLag.toFixed(2)}ms`,
        value: metrics.application.eventLoopLag,
        threshold: this.thresholds.application.eventLoopLag,
        timestamp: Date.now()
      });
    }

    // Error Rate Check
    if (metrics.application.errorRate > this.thresholds.application.errorRate) {
      alerts.push({
        type: 'critical',
        metric: 'error_rate',
        message: `High error rate: ${metrics.application.errorRate.toFixed(2)}%`,
        value: metrics.application.errorRate,
        threshold: this.thresholds.application.errorRate,
        timestamp: Date.now()
      });
    }

    metrics.alerts = alerts;
    
    if (alerts.length > 0) {
      this.alertHistory = [...this.alertHistory, ...alerts].slice(-100); // Keep last 100 alerts
      this.emit('alerts', alerts);
    }
  }

  private updateMetricsHistory(metrics: HealthMetrics) {
    this.metricsHistory.push(metrics);
    if (this.metricsHistory.length > this.historyLimit) {
      this.metricsHistory.shift();
    }
  }

  public getMetrics(): HealthMetrics {
    return this.metrics;
  }

  public getMetricsHistory(): HealthMetrics[] {
    return this.metricsHistory;
  }

  public getAlertHistory(): Alert[] {
    return this.alertHistory;
  }

  public updateThresholds(newThresholds: Partial<ThresholdConfig>) {
    this.thresholds = {
      ...this.thresholds,
      ...newThresholds
    };
  }

  public stop() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }
  }
}

export const healthMonitor = new HealthMonitor();
export type { HealthMetrics, Alert, ThresholdConfig };