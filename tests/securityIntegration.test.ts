import request from 'supertest';
import mongoose from 'mongoose';
import { authenticator } from 'otplib';
import { app } from '../src/server';
import User from '../src/models/user';
import { createAuditLog } from '../src/utils/auditLogger';
import { SessionManager } from '../src/config/session';

jest.mock('../src/utils/auditLogger', () => ({
  createAuditLog: jest.fn()
}));

describe('Security Features Integration', () => {
  let adminUser;
  let adminToken;
  let totpSecret;
  let sessionId;

  beforeAll(async () => {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/rdx_test');
  });

  beforeEach(async () => {
    await User.deleteMany({});

    // Create admin user with all security features enabled
    adminUser = await User.create({
      email: 'admin@test.com',
      password: 'password123',
      role: 'admin',
      securitySettings: {
        ipWhitelist: {
          enabled: true,
          ips: ['127.0.0.1', '192.168.1.0/24']
        },
        sessionTimeout: 3600, // 1 hour
        twoFactorAuth: {
          enabled: false // Will be enabled during tests
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
    sessionId = loginResponse.headers['set-cookie'][0]
      .split(';')[0]
      .split('=')[1];

    // Set up 2FA
    const setupResponse = await request(app)
      .get('/v1/2fa/setup')
      .set('Authorization', `Bearer ${adminToken}`);

    totpSecret = setupResponse.body.secret;
    const token = authenticator.generate(totpSecret);

    await request(app)
      .post('/v1/2fa/enable')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ token });
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  describe('Combined Security Features', () => {
    it('should require both IP whitelist and 2FA for admin access', async () => {
      const token = authenticator.generate(totpSecret);

      // Test with valid 2FA but invalid IP
      const response1 = await request(app)
        .get('/v1/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('X-TOTP-Token', token)
        .set('X-Forwarded-For', '10.0.0.1');

      expect(response1.status).toBe(403);
      expect(response1.body.code).toBe('IP_NOT_WHITELISTED');

      // Test with valid IP but no 2FA
      const response2 = await request(app)
        .get('/v1/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('X-Forwarded-For', '127.0.0.1');

      expect(response2.status).toBe(403);
      expect(response2.body.code).toBe('TWO_FACTOR_REQUIRED');

      // Test with both valid
      const response3 = await request(app)
        .get('/v1/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('X-TOTP-Token', token)
        .set('X-Forwarded-For', '127.0.0.1');

      expect(response3.status).toBe(200);
    });

    it('should handle session expiry with active 2FA', async () => {
      // Set a short session timeout
      await User.findByIdAndUpdate(adminUser._id, {
        'securitySettings.sessionTimeout': 1
      });

      const token = authenticator.generate(totpSecret);

      // Wait for session to expire
      await new Promise(resolve => setTimeout(resolve, 1100));

      const response = await request(app)
        .get('/v1/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('X-TOTP-Token', token)
        .set('X-Forwarded-For', '127.0.0.1');

      expect(response.status).toBe(440);
      expect(response.body.code).toBe('SESSION_EXPIRED');
    });

    it('should maintain audit log across security features', async () => {
      const token = authenticator.generate(totpSecret);

      // Generate several security events
      await request(app)
        .get('/v1/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('X-TOTP-Token', '123456') // Invalid 2FA
        .set('X-Forwarded-For', '127.0.0.1');

      await request(app)
        .get('/v1/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('X-TOTP-Token', token)
        .set('X-Forwarded-For', '10.0.0.1'); // Invalid IP

      await request(app)
        .delete('/v1/sessions')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('X-TOTP-Token', token)
        .set('X-Forwarded-For', '127.0.0.1');

      // Verify audit logs were created for all events
      expect(createAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'FAILED_2FA_ATTEMPT'
        })
      );

      expect(createAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'UNAUTHORIZED_IP_ACCESS'
        })
      );

      expect(createAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'TERMINATE_ALL_SESSIONS'
        })
      );
    });

    it('should handle concurrent sessions with different security states', async () => {
      // Create a second session
      const secondLogin = await request(app)
        .post('/v1/auth/login')
        .send({
          email: 'admin@test.com',
          password: 'password123'
        });

      const secondToken = secondLogin.body.token;
      const token = authenticator.generate(totpSecret);

      // First session with valid 2FA
      const response1 = request(app)
        .get('/v1/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('X-TOTP-Token', token)
        .set('X-Forwarded-For', '127.0.0.1');

      // Second session without 2FA
      const response2 = request(app)
        .get('/v1/admin/users')
        .set('Authorization', `Bearer ${secondToken}`)
        .set('X-Forwarded-For', '127.0.0.1');

      const [result1, result2] = await Promise.all([response1, response2]);

      expect(result1.status).toBe(200);
      expect(result2.status).toBe(403);
      expect(result2.body.code).toBe('TWO_FACTOR_REQUIRED');
    });

    it('should handle security feature changes across active sessions', async () => {
      const token = authenticator.generate(totpSecret);

      // Initial request with all security features
      const response1 = await request(app)
        .get('/v1/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('X-TOTP-Token', token)
        .set('X-Forwarded-For', '127.0.0.1');

      expect(response1.status).toBe(200);

      // Disable IP whitelist
      await User.findByIdAndUpdate(adminUser._id, {
        'securitySettings.ipWhitelist.enabled': false
      });

      // Request should now work from any IP but still require 2FA
      const response2 = await request(app)
        .get('/v1/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('X-TOTP-Token', token)
        .set('X-Forwarded-For', '10.0.0.1');

      expect(response2.status).toBe(200);

      // Disable 2FA
      await request(app)
        .post('/v1/2fa/disable')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('X-TOTP-Token', token)
        .set('X-Forwarded-For', '127.0.0.1');

      // Request should now work without any security features
      const response3 = await request(app)
        .get('/v1/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('X-Forwarded-For', '10.0.0.1');

      expect(response3.status).toBe(200);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle rapid security feature changes', async () => {
      const token = authenticator.generate(totpSecret);
      const changes = [
        // Enable/disable IP whitelist
        () => User.findByIdAndUpdate(adminUser._id, {
          'securitySettings.ipWhitelist.enabled': false
        }),
        () => User.findByIdAndUpdate(adminUser._id, {
          'securitySettings.ipWhitelist.enabled': true
        }),
        // Change session timeout
        () => User.findByIdAndUpdate(adminUser._id, {
          'securitySettings.sessionTimeout': 7200
        }),
        // Disable/enable 2FA
        () => request(app)
          .post('/v1/2fa/disable')
          .set('Authorization', `Bearer ${adminToken}`)
          .set('X-TOTP-Token', token)
          .set('X-Forwarded-For', '127.0.0.1'),
        () => request(app)
          .post('/v1/2fa/enable')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ token })
      ];

      // Execute changes rapidly
      await Promise.all(changes.map(change => change()));

      // System should remain in a consistent state
      const user = await User.findById(adminUser._id);
      expect(user.securitySettings).toBeDefined();
      expect(typeof user.securitySettings.ipWhitelist.enabled).toBe('boolean');
      expect(typeof user.securitySettings.sessionTimeout).toBe('number');
      expect(typeof user.securitySettings.twoFactorAuth.enabled).toBe('boolean');
    });

    it('should handle invalid security configurations gracefully', async () => {
      // Test with invalid IP format
      await User.findByIdAndUpdate(adminUser._id, {
        'securitySettings.ipWhitelist.ips': ['invalid-ip']
      });

      const token = authenticator.generate(totpSecret);

      const response = await request(app)
        .get('/v1/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('X-TOTP-Token', token)
        .set('X-Forwarded-For', '127.0.0.1');

      // Should default to denying access
      expect(response.status).toBe(403);
    });
  });
});