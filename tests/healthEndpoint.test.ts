import request from 'supertest';
import { app } from '../src/server'; // Adjusted import to match named export
import mongoose from 'mongoose';

jest.mock('mongoose', () => ({
  connection: { get readyState() { return 0; } }, // Mock readyState as a getter
}));

describe('GET /health', () => {
  test('should return ok: true and MongoDB status as connected', async () => {
    Object.defineProperty(mongoose.connection, 'readyState', { value: 1 }); // Mock connected state

    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      ok: true,
      mongo: 'connected',
    });
  });

  test('should return ok: true and MongoDB status as disconnected', async () => {
    Object.defineProperty(mongoose.connection, 'readyState', { value: 0 }); // Mock disconnected state

    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      ok: true,
      mongo: 'disconnected',
    });
  });
});
