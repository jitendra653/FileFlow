import { Request, Response, NextFunction } from 'express';
import { ValidationError as ExpressValidationError } from 'express-validator';
import { MongoError } from 'mongodb';
import logger from '../utils/logger';
import { createErrorResponse, ErrorType, ErrorDetail, createValidationError, ErrorResponse } from '../utils/errorResponse';
import { securityMonitor } from '../utils/securityMonitor';

// Extend Request type to include the request ID
declare global {
  namespace Express {
    interface Request {
      id?: string;
    }
  }
}

// Type for error response with debug info
interface ErrorResponseWithDebug extends ErrorResponse {
  error: ErrorResponse['error'] & {
    debug?: {
      stack?: string;
      name?: string;
    };
  };
}

// Base error class for application errors
export class AppError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public code: string,
    public type: ErrorType = ErrorType.BAD_REQUEST,
    public details?: ErrorDetail[]
  ) {
    super(message);
    this.name = 'AppError';
    Object.setPrototypeOf(this, AppError.prototype);
  }

  static badRequest(message: string, code: string, details?: ErrorDetail[]): AppError {
    return new AppError(400, message, code, ErrorType.BAD_REQUEST, details);
  }

  static unauthorized(message: string, code: string = 'UNAUTHORIZED'): AppError {
    return new AppError(401, message, code, ErrorType.AUTHENTICATION);
  }

  static forbidden(message: string, code: string = 'FORBIDDEN'): AppError {
    return new AppError(403, message, code, ErrorType.AUTHORIZATION);
  }

  static notFound(message: string, code: string = 'NOT_FOUND'): AppError {
    return new AppError(404, message, code, ErrorType.NOT_FOUND);
  }

  static conflict(message: string, code: string = 'CONFLICT'): AppError {
    return new AppError(409, message, code, ErrorType.CONFLICT);
  }

  static tooManyRequests(message: string, code: string = 'RATE_LIMIT_EXCEEDED'): AppError {
    return new AppError(429, message, code, ErrorType.RATE_LIMIT);
  }

  static internal(message: string = 'Internal server error', code: string = 'INTERNAL_ERROR'): AppError {
    return new AppError(500, message, code, ErrorType.SERVER_ERROR);
  }
}

// Validation error class
export class ValidationAppError extends AppError {
  constructor(errors: ExpressValidationError[]) {
    const details = errors.map(err => {
      if ('param' in err && 'msg' in err) {
        return createValidationError(
          err.param as string,
          err.msg as string,
          (err as any).value
        );
      }
      return createValidationError(
        'unknown',
        'Invalid field',
        undefined
      );
    });
    super(400, 'Validation failed', 'VALIDATION_FAILED', ErrorType.VALIDATION, details);
    Object.setPrototypeOf(this, ValidationAppError.prototype);
  }
}

export async function errorHandler(err: Error, req: Request, res: Response, next: NextFunction) {
  let statusCode = 500;
  let errorResponseOptions: any = {
    code: 'INTERNAL_ERROR',
    message: 'Internal server error',
    type: ErrorType.SERVER_ERROR,
    path: req.path,
    requestId: req.id,
    traceId: req.headers['x-trace-id'] as string
  };

  // Handle known error types
  if (err instanceof AppError) {
    statusCode = err.statusCode;
    errorResponseOptions = {
      code: err.code,
      message: err.message,
      type: err.type,
      details: err.details,
      path: req.path,
      requestId: req.id,
      traceId: req.headers['x-trace-id'] as string
    };
  } 
  // Handle MongoDB errors
  else if (err instanceof MongoError) {
    if (err.code === 11000) {
      statusCode = 409;
      errorResponseOptions = {
        code: 'DUPLICATE_ENTRY',
        message: 'Duplicate entry detected',
        type: ErrorType.CONFLICT,
        details: [{
          code: 'DUPLICATE_KEY',
          message: err.message
        }],
        path: req.path,
        requestId: req.id,
        traceId: req.headers['x-trace-id'] as string
      };
    }
  }
  // Handle validation errors
  else if (err instanceof ValidationAppError) {
    statusCode = 400;
    errorResponseOptions = {
      code: 'VALIDATION_FAILED',
      message: 'Validation failed',
      type: ErrorType.VALIDATION,
      details: (err as ValidationAppError).details,
      path: req.path,
      requestId: req.id,
      traceId: req.headers['x-trace-id'] as string
    };
  }

  // Create structured error response
  const errorResponse = createErrorResponse(errorResponseOptions) as ErrorResponseWithDebug;

  // Log error with appropriate severity and context
  const logContext = {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    ip: req.ip,
    userId: req.session?.userId,
    requestId: req.id,
    traceId: req.headers['x-trace-id'],
    query: req.query,
    body: req.body, // Be careful with sensitive data
    statusCode,
    errorType: errorResponseOptions.type,
    errorCode: errorResponseOptions.code
  };

  if (statusCode >= 500) {
    logger.error('Server error occurred', logContext);
    
    // Track server errors in security monitor
    if (req.session?.userId) {
      await securityMonitor.trackSessionError(
        req.session.userId,
        req.sessionID,
        'server_error'
      );
    }
  } else {
    logger.warn('Client error occurred', logContext);
  }

  // In development, include additional debug information
  if (process.env.NODE_ENV === 'development') {
    errorResponse.error.debug = {
      stack: err.stack,
      name: err.name
    };
  }

  res.status(statusCode).json(errorResponse);
}
