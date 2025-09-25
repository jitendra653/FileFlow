import request from 'supertest';
import { app } from '../src/server';
import client from 'prom-client';

describe('GET /metrics', () => {
  beforeEach(() => {
    client.register.clear(); // Clear metrics registry before each test
  });

  test('should return 200 OK and include default metrics', async () => {
    const response = await request(app).get('/metrics');

    expect(response.status).toBe(200);
    expect(response.text).toContain('http_request_duration_seconds');
  });

  test('should include rate limiter throttled requests metric', async () => {
    const throttledRequestsCounter = new client.Counter({
      name: 'rate_limiter_throttled_requests_total',
      help: 'Total number of throttled requests',
    });

    throttledRequestsCounter.inc(5); // Simulate 5 throttled requests

    const response = await request(app).get('/metrics');

    expect(response.status).toBe(200);
    expect(response.text).toContain('rate_limiter_throttled_requests_total 5');
  });
});
