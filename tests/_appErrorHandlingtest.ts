import request from 'supertest';
import express from 'express';
import {app as mainApp} from '../src/server';
import logger from '../src/utils/logger';

jest.mock('../src/utils/logger');

// Create a separate Express app for testing
const app = express();
app.use(express.json());

// Simulate a route that throws an error
app.get('/error', (req, res) => {
  throw new Error('Test error');
});

// Use the same error handling middleware as your main app
// Assuming your error handler is exported from server or another file
import { errorHandler } from '../src/middleware/errorHandler';
app.use(errorHandler);

describe('Centralized Error Handling Middleware', () => {
  test('should log errors and return a 500 response', async () => {
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
