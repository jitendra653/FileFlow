import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';
import crypto from 'crypto';

export default function requestTrace(req: Request, res: Response, next: NextFunction) {
  const headerId = req.headers['x-request-id'];
  const id = (typeof headerId === 'string' && /^[a-f0-9]{32}$/.test(headerId))
    ? headerId
    : crypto.randomUUID();
  res.setHeader('x-request-id', id);
  const start = process.hrtime();
  res.on('finish', () => {
    const diff = process.hrtime(start);
    const ms = (diff[0] * 1e3) + (diff[1] / 1e6);
    logger.info(`${req.method} ${req.originalUrl} ${res.statusCode} - ${ms.toFixed(2)}ms - reqId=${id}`);
  });
  next();
}
