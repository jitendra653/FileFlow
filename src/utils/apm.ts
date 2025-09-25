import newrelic from 'newrelic';

interface CustomMetric {
  name: string;
  value: number;
  attributes?: Record<string, any>;
}

interface CustomEvent {
  eventType: string;
  attributes: Record<string, any>;
}

class APMService {
  private static instance: APMService;

  private constructor() {}

  static getInstance(): APMService {
    if (!APMService.instance) {
      APMService.instance = new APMService();
    }
    return APMService.instance;
  }

  /**
   * Start monitoring a custom segment of code
   * @param name Name of the segment
   */
  startSegment(name: string, category = 'Custom') {
    return newrelic.startSegment(name, false, () => {
      return new Promise((resolve) => {
        resolve(true);
      });
    });
  }

  /**
   * Record a custom metric
   * @param metric Metric details including name, value, and optional attributes
   */
  recordMetric(metric: CustomMetric): void {
    newrelic.recordMetric(metric.name, metric.value);
    if (metric.attributes) {
      this.addCustomAttributes(metric.attributes);
    }
  }

  /**
   * Record a custom event
   * @param event Event details including type and attributes
   */
  recordCustomEvent(event: CustomEvent): void {
    newrelic.recordCustomEvent(event.eventType, event.attributes);
  }

  /**
   * Add custom attributes to the current transaction
   * @param attributes Key-value pairs of attributes
   */
  addCustomAttributes(attributes: Record<string, any>): void {
    newrelic.addCustomAttributes(attributes);
  }

  /**
   * Record an error with custom attributes
   * @param error Error object
   * @param customAttributes Additional attributes for context
   */
  noticeError(error: Error, customAttributes?: Record<string, any>): void {
    newrelic.noticeError(error, customAttributes);
  }

  /**
   * Start a web transaction
   * @param name Name/category of the transaction
   */
  startWebTransaction(name: string, callback: () => Promise<any>): Promise<any> {
    return newrelic.startWebTransaction(name, callback);
  }

  /**
   * Start a background transaction
   * @param name Name/category of the transaction
   */
  startBackgroundTransaction(name: string, callback: () => Promise<any>): Promise<any> {
    return newrelic.startBackgroundTransaction(name, callback);
  }

  /**
   * Instrument WebSocket connections
   * @param eventName Name of the WebSocket event
   * @param attributes Additional attributes for the event
   */
  instrumentWebSocket(eventName: string, attributes: Record<string, any> = {}): void {
    this.recordCustomEvent({
      eventType: 'WebSocketEvent',
      attributes: {
        eventName,
        timestamp: new Date().toISOString(),
        ...attributes
      }
    });
  }

  /**
   * Monitor file processing performance
   * @param fileId ID of the file being processed
   * @param operation Type of operation being performed
   */
  monitorFileProcessing(fileId: string, operation: string): void {
    const segment = this.startSegment(`FileProcessing/${operation}`);
    this.addCustomAttributes({
      fileId,
      operation,
      startTime: new Date().toISOString()
    });
    return segment;
  }
}

export const apm = APMService.getInstance();