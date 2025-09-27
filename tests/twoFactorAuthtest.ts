import request from 'supertest';
import mongoose from 'mongoose';
import { authenticator } from 'otplib';
import { app } from '../src/server';
import User from '../src/models/user';
import { createAuditLog } from '../src/utils/auditLogger';

jest.mock('../src/utils/auditLogger', () => ({
  createAuditLog: jest.fn()
}));

describe('Two-Factor Authentication', () => {
  let adminUser;
  let adminToken;
  let totpSecret;

  beforeAll(async () => {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/rdx_test');
  });

  beforeEach(async () => {
    await User.deleteMany({});

    // Create admin user
    adminUser = await User.create({
      email: 'admin@test.com',
      password: 'password123',
      role: 'admin'
    });

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

  describe('2FA Setup', () => {
    it('should generate 2FA setup information', async () => {
      const response = await request(app)
        .get('/v1/2fa/setup')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('qrCode');
      expect(response.body).toHaveProperty('backupCodes');
      expect(response.body.backupCodes).toHaveLength(10);
    });

    it('should enable 2FA with valid token', async () => {
      // First get setup info
      const setupResponse = await request(app)
        .get('/v1/2fa/setup')
        .set('Authorization', `Bearer ${adminToken}`);

      totpSecret = setupResponse.body.secret;
      const token = authenticator.generate(totpSecret);

      const response = await request(app)
        .post('/v1/2fa/enable')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ token });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('2FA enabled successfully');
      expect(createAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'ENABLE_2FA'
        })
      );

      // Verify user has 2FA enabled in database
      const user = await User.findById(adminUser._id);
      expect(user.securitySettings.twoFactorAuth.enabled).toBe(true);
    });

    it('should reject invalid 2FA tokens', async () => {
      const response = await request(app)
        .post('/v1/2fa/enable')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ token: '123456' });

      expect(response.status).toBe(400);
      expect(response.body.code).toBe('INVALID_TOKEN');
    });
  });

  describe('2FA Verification', () => {
    beforeEach(async () => {
      // Setup 2FA for admin
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

    it('should allow access with valid 2FA token', async () => {
      const token = authenticator.generate(totpSecret);

      const response = await request(app)
        .get('/v1/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('X-TOTP-Token', token);

      expect(response.status).not.toBe(403);
    });

    it('should deny access without 2FA token', async () => {
      const response = await request(app)
        .get('/v1/admin/users')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(403);
      expect(response.body.code).toBe('TWO_FACTOR_REQUIRED');
    });

    it('should deny access with invalid 2FA token', async () => {
      const response = await request(app)
        .get('/v1/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('X-TOTP-Token', '123456');

      expect(response.status).toBe(403);
      expect(response.body.code).toBe('INVALID_TWO_FACTOR');
      expect(createAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'FAILED_2FA_ATTEMPT'
        })
      );
    });

    it('should allow access with valid backup code', async () => {
      // Get backup codes
      const user = await User.findById(adminUser._id);
      const backupCode = user.securitySettings.twoFactorAuth.backupCodes[0];

      const response = await request(app)
        .get('/v1/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('X-Backup-Code', backupCode);

      expect(response.status).not.toBe(403);

      // Verify backup code was consumed
      const updatedUser = await User.findById(adminUser._id);
      expect(updatedUser.securitySettings.twoFactorAuth.backupCodes).not.toContain(backupCode);
    });
  });

  describe('2FA Management', () => {
    it('should disable 2FA with valid token', async () => {
      const token = authenticator.generate(totpSecret);

      const response = await request(app)
        .post('/v1/2fa/disable')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ token });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('2FA disabled successfully');
      expect(createAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'DISABLE_2FA'
        })
      );

      // Verify 2FA is disabled in database
      const user = await User.findById(adminUser._id);
      expect(user.securitySettings.twoFactorAuth.enabled).toBe(false);
    });

    it('should generate new backup codes with valid token', async () => {
      const token = authenticator.generate(totpSecret);

      const response = await request(app)
        .post('/v1/2fa/backup-codes')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ token });

      expect(response.status).toBe(200);
      expect(response.body.backupCodes).toHaveLength(10);
      expect(createAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'GENERATE_2FA_BACKUP_CODES'
        })
      );
    });
  });
});