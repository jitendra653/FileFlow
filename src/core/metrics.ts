import client from 'prom-client';
import { Request, Response, NextFunction } from 'express';

const collectDefaultMetrics = client.collectDefaultMetrics;
collectDefaultMetrics();

export const httpRequestDurationMicroseconds = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 0.5, 1, 1.5],
});

export const requestCounter = new client.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
});

export const successCounter = new client.Counter({
  name: 'http_requests_success_total',
  help: 'Total number of successful HTTP requests',
  labelNames: ['method', 'route'],
});

export const failureCounter = new client.Counter({
  name: 'http_requests_failure_total',
  help: 'Total number of failed HTTP requests',
  labelNames: ['method', 'route'],
});

export function metricsMiddleware(req: Request, res: Response, next: NextFunction) {
  const start = process.hrtime();
  res.on('finish', () => {
    const [seconds, nanoseconds] = process.hrtime(start);
    const durationInSeconds = seconds + nanoseconds / 1e9;
    httpRequestDurationMicroseconds.labels(req.method, req.route?.path || req.url, res.statusCode.toString()).observe(durationInSeconds);
    requestCounter.labels(req.method, req.route?.path || req.url, res.statusCode.toString()).inc();
    if (res.statusCode >= 200 && res.statusCode < 300) {
      successCounter.labels(req.method, req.route?.path || req.url).inc();
    } else if (res.statusCode >= 400) {
      failureCounter.labels(req.method, req.route?.path || req.url).inc();
    }
  });
  next();
}

export function metricsRoute(req: Request, res: Response) {
  res.set('Content-Type', client.register.contentType);
  client.register.metrics().then(metrics => res.end(metrics));
}
