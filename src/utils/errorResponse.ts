export interface ErrorDetail {
  field?: string;
  code: string;
  message: string;
  value?: any;
}

export interface ErrorResponse {
  error: {
    code: string;
    message: string;
    type: ErrorType;
    details?: ErrorDetail[];
    requestId?: string;
    traceId?: string;
    timestamp: string;
    path?: string;
  };
}

export enum ErrorType {
  VALIDATION = 'VALIDATION_ERROR',
  AUTHENTICATION = 'AUTHENTICATION_ERROR',
  AUTHORIZATION = 'AUTHORIZATION_ERROR',
  NOT_FOUND = 'NOT_FOUND',
  CONFLICT = 'CONFLICT',
  RATE_LIMIT = 'RATE_LIMIT_ERROR',
  BAD_REQUEST = 'BAD_REQUEST',
  SERVER_ERROR = 'SERVER_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  DATABASE_ERROR = 'DATABASE_ERROR'
}

export interface ErrorResponseOptions {
  code: string;
  message: string;
  type: ErrorType;
  details?: ErrorDetail[];
  requestId?: string;
  traceId?: string;
  path?: string;
}

export function createErrorResponse(options: ErrorResponseOptions): ErrorResponse {
  return {
    error: {
      code: options.code,
      message: options?.message,
      type: options.type,
      details: options.details,
      requestId: options.requestId,
      traceId: options.traceId,
      timestamp: new Date().toISOString(),
      path: options.path,
      options: options
    }
  };
}

// Helper function to create validation error details
export function createValidationError(field: string, message: string, value?: any): ErrorDetail {
  return {
    field,
    code: 'INVALID_FIELD',
    message,
    value
  };
}

// Helper function to create a not found error detail
export function createNotFoundError(resource: string, identifier: string): ErrorDetail {
  return {
    field: resource,
    code: 'RESOURCE_NOT_FOUND',
    message: `${resource} with identifier '${identifier}' was not found`,
    value: identifier
  };
}
