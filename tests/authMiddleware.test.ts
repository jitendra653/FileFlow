import { requireAuth, AuthRequest } from '../src/middleware/auth';
import jwt from 'jsonwebtoken';
import logger from '../src/utils/logger';
import { createErrorResponse } from '../src/utils/errorResponse';
import { Response, NextFunction } from 'express';

jest.mock('../src/utils/logger');
jest.mock('jsonwebtoken');

describe('Auth Middleware', () => {
  let mockReq: Partial<AuthRequest>;
  let mockRes: Partial<Response>;
  let mockNext: jest.Mock;

  beforeEach(() => {
    mockReq = {};
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    mockNext = jest.fn();
  });

  test('should return standardized error response if authorization header is missing', () => {
    requireAuth(mockReq as AuthRequest, mockRes as Response, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockRes.json).toHaveBeenCalledWith(createErrorResponse('Missing authorization header'));
    expect(logger.warn).toHaveBeenCalledWith('Authorization header missing');
  });

  test('should return standardized error response if authorization header is malformed', () => {
    mockReq.headers = { authorization: 'Bearer' };

    requireAuth(mockReq as AuthRequest, mockRes as Response, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockRes.json).toHaveBeenCalledWith(createErrorResponse('Malformed authorization header'));
    expect(logger.warn).toHaveBeenCalledWith('Malformed authorization header', { header: 'Bearer' });
  });

  test('should return standardized error response if token is expired', () => {
    mockReq.headers = { authorization: 'Bearer expiredToken' };
    (jwt.verify as jest.Mock).mockImplementation(() => {
      const error = new Error('Token expired');
      (error as any).name = 'TokenExpiredError';
      throw error;
    });

    requireAuth(mockReq as AuthRequest, mockRes as Response, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockRes.json).toHaveBeenCalledWith(createErrorResponse('Token has expired'));
    expect(logger.warn).toHaveBeenCalledWith('Expired token', { token: 'expiredToken' });
  });

  test('should return standardized error response if token is invalid', () => {
    mockReq.headers = { authorization: 'Bearer invalidToken' };
    (jwt.verify as jest.Mock).mockImplementation(() => {
      throw new Error('Invalid token');
    });

    requireAuth(mockReq as AuthRequest, mockRes as Response, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockRes.json).toHaveBeenCalledWith(createErrorResponse('Invalid token'));
    expect(logger.error).toHaveBeenCalledWith('Invalid token', { error: 'Invalid token' });
  });

  test('should call next if token is valid', () => {
    mockReq.headers = { authorization: 'Bearer validToken' };
    (jwt.verify as jest.Mock).mockReturnValue({ id: 'user123' });

    requireAuth(mockReq as AuthRequest, mockRes as Response, mockNext);

    expect(mockNext).toHaveBeenCalled();
    expect(mockReq.user).toEqual({ id: 'user123' });
  });
});
