import request from 'supertest';
import {app} from '../src/server'; // Assuming this is the entry point of your app
import FileModel from '../src/models/file';
import jwt from 'jsonwebtoken';

jest.mock('../src/models/file');

describe('Rate limiting on /files/generate-token', () => {
  let mockUser: any;
  let mockFile: any;

  beforeEach(() => {
    mockUser = { id: 'user123', _id: 'user123' };
    mockFile = { _id: 'file123', path: '/tmp/file.png', userId: 'user123' };
    (FileModel.findById as jest.Mock).mockResolvedValue(mockFile);
  });

  test('should allow up to 10 requests per minute', async () => {
    const token = jwt.sign(mockUser, 'test-secret');

    for (let i = 0; i < 10; i++) {
      const response = await request(app)
        .post('/files/generate-token')
        .set('Authorization', `Bearer ${token}`)
        .send({ fileId: 'file123', expiresIn: '10m' });

      expect(response.status).toBe(200);
    }
  });

  test('should block requests after rate limit is exceeded', async () => {
    const token = jwt.sign(mockUser, 'test-secret');

    for (let i = 0; i < 10; i++) {
      await request(app)
        .post('/files/generate-token')
        .set('Authorization', `Bearer ${token}`)
        .send({ fileId: 'file123', expiresIn: '10m' });
    }

    const response = await request(app)
      .post('/files/generate-token')
      .set('Authorization', `Bearer ${token}`)
      .send({ fileId: 'file123', expiresIn: '10m' });

    expect(response.status).toBe(429);
    expect(response.body.error).toBe('Too many requests, please try again later.');
  });
});
