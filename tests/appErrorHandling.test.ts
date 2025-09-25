import request from 'supertest';
import {app} from '../src/server';
import logger from '../src/utils/logger';

jest.mock('../src/utils/logger');

describe('Centralized Error Handling Middleware', () => {
  test('should log errors and return a 500 response', async () => {
    // Simulate a route that throws an error
    app.get('/error', (req, res) => {
      throw new Error('Test error');
    });

    const response = await request(app).get('/error');

    // Verify the logger was called with the error
    expect(logger.error).toHaveBeenCalledWith(
      'Unhandled error occurred',
      expect.objectContaining({
        error: 'Test error',
        stack: expect.any(String),
      })
    );

    // Verify the response structure
    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      error: 'Internal server error',
      message: 'Test error',
    });
  });
});
