import { requireAuth, AuthRequest } from '../src/middleware/auth';
import jwt from 'jsonwebtoken';
import logger from '../src/utils/logger';
import { createErrorResponse, ErrorType } from '../src/utils/errorResponse';
import { Response, NextFunction } from 'express';

jest.mock('../src/utils/logger');
jest.mock('jsonwebtoken');

describe('Auth Middleware', () => {
  let mockReq: Partial<AuthRequest>;
  let mockRes: Partial<Response>;
  let mockNext: jest.Mock;

  beforeEach(() => {
    mockReq = {
      originalUrl: '/api/protected',
      headers: {},
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    mockNext = jest.fn();
  });

  test('should return standardized error response if authorization header is missing', () => {
    mockReq.headers = {};
    mockReq.originalUrl = '/api/protected';
    requireAuth(mockReq as AuthRequest, mockRes as Response, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
      code: 'AUTH_HEADER_MISSING',
      message: 'Missing authorization header',
      type: expect.stringMatching(/AUTHENTICATION/i)
    }));
    expect(logger.warn).toHaveBeenCalledWith('Authorization header missing');
  });

  test('should return standardized error response if authorization header is malformed', () => {
    mockReq.headers = { authorization: 'Bearer' };
    mockReq.originalUrl = '/api/protected';

    requireAuth(mockReq as AuthRequest, mockRes as Response, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
      code: 'AUTH_HEADER_MALFORMED',
      message: 'Malformed authorization header',
      type: expect.stringMatching(/AUTHENTICATION/i)
    }));
    expect(logger.warn).toHaveBeenCalledWith('Malformed authorization header', { header: 'Bearer' });
  });

  test('should return standardized error response if token is expired', () => {
    mockReq.headers = { authorization: 'Bearer expiredToken' };
    mockReq.originalUrl = '/api/protected';
    (jwt.verify as jest.Mock).mockImplementation(() => {
      const error = new Error('Token expired');
      (error as any).name = 'TokenExpiredError';
      throw error;
    });

    requireAuth(mockReq as AuthRequest, mockRes as Response, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
      code: 'TOKEN_EXPIRED',
      message: 'Token has expired',
      type: expect.stringMatching(/AUTHENTICATION/i)
    }));
    expect(logger.warn).toHaveBeenCalledWith('Expired token', { token: 'expiredToken' });
  });

  test('should return standardized error response if token is invalid', () => {
    mockReq.headers = { authorization: 'Bearer invalidToken' };
    mockReq.originalUrl = '/api/protected';
    (jwt.verify as jest.Mock).mockImplementation(() => {
      throw new Error('Invalid token');
    });

    requireAuth(mockReq as AuthRequest, mockRes as Response, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
      code: 'TOKEN_INVALID',
      message: 'Invalid token',
      type: expect.stringMatching(/AUTHENTICATION/i)
    }));
    expect(logger.error).toHaveBeenCalledWith('Invalid token', { error: 'Invalid token' });
  });

  test('should call next if token is valid', () => {
    mockReq.headers = { authorization: 'Bearer validToken' };
    mockReq.originalUrl = '/api/protected';
    (jwt.verify as jest.Mock).mockReturnValue({ id: 'user123' });

    requireAuth(mockReq as AuthRequest, mockRes as Response, mockNext);

    expect(mockNext).toHaveBeenCalled();
    expect(mockReq.user).toEqual({ id: 'user123' });
  });
});
