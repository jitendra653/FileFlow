import request from 'supertest';
import { app } from '../../src/server';
import client from 'prom-client';

describe('Prometheus Metrics', () => {
  // beforeEach(() => {
  //   client.register.clear();
  // });

  test('should record request counts and durations', async () => {
    await request(app).get('/health');
    const metrics = await request(app).get('/metrics');
    expect(metrics.status).toBe(200);
    expect(metrics.text).toContain('http_requests_total');
    expect(metrics.text).toContain('http_request_duration_seconds');
  });
});
