import request from 'supertest';
import mongoose from 'mongoose';
import { app } from '../src/server';
import User from '../src/models/user';
import { createAuditLog } from '../src/utils/auditLogger';

jest.mock('../src/utils/auditLogger', () => ({
  createAuditLog: jest.fn()
}));

describe('IP Whitelist Middleware', () => {
  let adminUser;
  let adminToken;

  beforeAll(async () => {
    // Connect to test database
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/rdx_test');
  });

  beforeEach(async () => {
    // Clear database
    await User.deleteMany({});

    // Create admin user with IP whitelist enabled
    adminUser = await User.create({
      email: 'admin@test.com',
      password: 'password123',
      role: 'admin',
      securitySettings: {
        ipWhitelist: {
          enabled: true,
          ips: ['127.0.0.1', '192.168.1.0/24']
        }
      }
    });

    // Login to get token
    const loginResponse = await request(app)
      .post('/v1/auth/login')
      .send({
        email: 'admin@test.com',
        password: 'password123'
      });

    adminToken = loginResponse.body.token;
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  it('should allow access from whitelisted IP', async () => {
    const response = await request(app)
      .get('/v1/admin/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('X-Forwarded-For', '127.0.0.1');

    expect(response.status).not.toBe(403);
  });

  it('should allow access from whitelisted CIDR range', async () => {
    const response = await request(app)
      .get('/v1/admin/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('X-Forwarded-For', '192.168.1.100');

    expect(response.status).not.toBe(403);
  });

  it('should deny access from non-whitelisted IP', async () => {
    const response = await request(app)
      .get('/v1/admin/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('X-Forwarded-For', '10.0.0.1');

    expect(response.status).toBe(403);
    expect(response.body.code).toBe('IP_NOT_WHITELISTED');
    expect(createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'UNAUTHORIZED_IP_ACCESS'
      })
    );
  });

  it('should allow access when IP whitelist is disabled', async () => {
    // Update user to disable IP whitelist
    await User.findByIdAndUpdate(adminUser._id, {
      'securitySettings.ipWhitelist.enabled': false
    });

    const response = await request(app)
      .get('/v1/admin/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('X-Forwarded-For', '10.0.0.1');

    expect(response.status).not.toBe(403);
  });

  it('should not apply IP whitelist to non-admin users', async () => {
    // Create regular user
    const regularUser = await User.create({
      email: 'user@test.com',
      password: 'password123',
      role: 'user',
      securitySettings: {
        ipWhitelist: {
          enabled: true,
          ips: ['127.0.0.1']
        }
      }
    });

    const loginResponse = await request(app)
      .post('/v1/auth/login')
      .send({
        email: 'user@test.com',
        password: 'password123'
      });

    const userToken = loginResponse.body.token;

    const response = await request(app)
      .get('/v1/profile')
      .set('Authorization', `Bearer ${userToken}`)
      .set('X-Forwarded-For', '10.0.0.1');

    expect(response.status).not.toBe(403);
  });
});