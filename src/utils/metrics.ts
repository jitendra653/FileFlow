import client from 'prom-client';

// Create a singleton registry
class MetricsRegistry {
  private static instance: MetricsRegistry;
  private metricsInitialized = false;
  public readonly registry: typeof client.register;

  private constructor() {
    // Clear any existing metrics
    client.register.clear();
    
    this.registry = client.register;
    this.initializeMetrics();
  }

  public static getInstance(): MetricsRegistry {
    if (!MetricsRegistry.instance) {
      MetricsRegistry.instance = new MetricsRegistry();
    }
    return MetricsRegistry.instance;
  }

  private initializeMetrics(): void {
    if (!this.metricsInitialized) {
      // Only collect default metrics once
      client.collectDefaultMetrics({
        register: this.registry,
        prefix: 'app_'  // Add prefix to avoid conflicts
      });
      this.metricsInitialized = true;
    }
  }

  public resetMetrics(): void {
    this.registry.clear();
    this.metricsInitialized = false;
    this.initializeMetrics();
  }
}

// Get singleton instance
const metricsInstance = MetricsRegistry.getInstance();

// Export the registry
export const register = metricsInstance.registry;

// Re-export Prometheus client classes with proper registry binding
export class Counter extends client.Counter {
  constructor(config: client.CounterConfiguration<string>) {
    super({ ...config, registers: [register] });
  }
}

export class Gauge extends client.Gauge {
  constructor(config: client.GaugeConfiguration<string>) {
    super({ ...config, registers: [register] });
  }
}

export class Histogram extends client.Histogram {
  constructor(config: client.HistogramConfiguration<string>) {
    super({ ...config, registers: [register] });
  }
}

export class Summary extends client.Summary {
  constructor(config: client.SummaryConfiguration<string>) {
    super({ ...config, registers: [register] });
  }
}

// Export client for advanced usage
export const promClient = client;

export default register;