import { Request, Response, NextFunction } from 'express';
import { apm } from '../utils/apm';

export function apmMiddleware(req: Request, res: Response, next: NextFunction) {
  // Start monitoring the request
  const segment = apm.startSegment(`HTTP/${req.method}${req.route?.path || req.path}`);

  // Add custom attributes for the request
  apm.addCustomAttributes({
    method: req.method,
    path: req.route?.path || req.path,
    query: req.query,
    userAgent: req.get('user-agent'),
    requestId: req.get('x-request-id') || 'unknown'
  });

  // Monitor response
  res.on('finish', () => {
    apm.addCustomAttributes({
      statusCode: res.statusCode,
      statusMessage: res.statusMessage
    });

    // Record response time metric
    const responseTime = res.get('X-Response-Time');
    if (responseTime) {
      apm.recordMetric({
        name: 'http/response_time',
        value: parseFloat(responseTime),
        attributes: {
          method: req.method,
          path: req.route?.path || req.path,
          statusCode: res.statusCode
        }
      });
    }

    // End the segment
    if (segment) {
      segment.end();
    }
  });

  next();
}