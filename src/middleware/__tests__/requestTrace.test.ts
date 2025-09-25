import requestTrace from '../requestTrace';
import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4, validate as isUuid } from 'uuid';

jest.mock('uuid', () => ({
  v4: jest.fn(() => 'mock-uuid'),
  validate: jest.requireActual('uuid').validate,
}));

describe('requestTrace middleware', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: jest.Mock;

  beforeEach(() => {
    req = { headers: {} };
    res = {
      setHeader: jest.fn(),
      on: jest.fn((event: string, callback: () => void) => {
        if (event === 'finish') callback();
        return res as Response;
      }),
    };
    next = jest.fn();
  });

  it('should use x-request-id if valid', () => {
    req.headers['x-request-id'] = '123e4567-e89b-12d3-a456-426614174000';

    requestTrace(req as Request, res as Response, next);

    expect(res.setHeader).toHaveBeenCalledWith('x-request-id', '123e4567-e89b-12d3-a456-426614174000');
    expect(next).toHaveBeenCalled();
  });

  it('should generate a new UUID if x-request-id is invalid', () => {
    req.headers['x-request-id'] = 'invalid-uuid';

    requestTrace(req as Request, res as Response, next);

    expect(res.setHeader).toHaveBeenCalledWith('x-request-id', 'mock-uuid');
    expect(next).toHaveBeenCalled();
  });

  it('should generate a new UUID if x-request-id is missing', () => {
    requestTrace(req as Request, res as Response, next);

    expect(res.setHeader).toHaveBeenCalledWith('x-request-id', 'mock-uuid');
    expect(next).toHaveBeenCalled();
  });
});
