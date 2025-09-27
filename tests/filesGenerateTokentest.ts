import request from 'supertest';
import { app } from '../src/server';
import FileModel from '../src/models/file';
import jwt from 'jsonwebtoken';

jest.mock('../src/models/file');

describe('POST /v1/files/generate-token', () => {
  let mockUser: any;
  let mockFile: any;

  beforeEach(() => {
    mockUser = { id: 'user123', _id: 'user123' };
    mockFile = { _id: 'file123', path: '/tmp/file.png', userId: 'user123' };
    (FileModel.findById as jest.Mock).mockResolvedValue(mockFile);
  });

  test('should generate a token for valid request', async () => {
    const response = await request(app)
      .post('/v1/files/generate-token')
      .set('Authorization', `Bearer ${jwt.sign(mockUser, 'test-secret')}`)
      .send({ fileId: 'file123', expiresIn: '10m' });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('token');
    expect(response.body).toHaveProperty('url');
    expect(response.body).toHaveProperty('expiresAt');
  });

  test('should return 400 for missing fileId', async () => {
    const response = await request(app)
      .post('/v1/files/generate-token')
      .set('Authorization', `Bearer ${jwt.sign(mockUser, 'test-secret')}`)
      .send({ expiresIn: '10m' });

    expect(response.status).toBe(400);
    expect(response.body.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ msg: 'fileId is required' })
      ])
    );
  });

  test('should return 400 for invalid expiresIn', async () => {
    const response = await request(app)
      .post('/v1/files/generate-token')
      .set('Authorization', `Bearer ${jwt.sign(mockUser, 'test-secret')}`)
      .send({ fileId: 'file123', expiresIn: 123 });

    expect(response.status).toBe(400);
    expect(response.body.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ msg: 'expiresIn must be a string' })
      ])
    );
  });
});
