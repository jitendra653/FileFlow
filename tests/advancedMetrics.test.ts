import request from 'supertest';
import { app } from '../src/server';
import client from 'prom-client';

describe('Advanced Prometheus Metrics', () => {
  beforeEach(() => {
    client.register.clear();
  });

  test('should record success and failure metrics', async () => {
    // Simulate a successful request
    await request(app).get('/health');

    // Simulate a failed request
    await request(app).get('/non-existent-route');

    const metrics = await request(app).get('/metrics');
    console.log(metrics.text); // Log metrics output for debugging
    expect(metrics.status).toBe(200);
    expect(metrics.text).toContain('http_requests_success_total');
    expect(metrics.text).toContain('http_requests_failure_total');
  });
});
