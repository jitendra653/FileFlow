import request from 'supertest';
import { app } from '../src/server'; // Assuming this is the entry point of your app
import FileModel from '../src/models/file';
import jwt from 'jsonwebtoken';

jest.mock('../src/models/file');

describe('POST /files/generate-token', () => {
  let mockUser: any;
  let mockFile: any;

  beforeEach(() => {
    mockUser = { id: 'user123', _id: 'user123' };
    mockFile = { _id: 'file123', path: '/tmp/file.png', userId: 'user123' };
    (FileModel.findById as jest.Mock).mockResolvedValue(mockFile);
  });

  test('should generate a token and return token, url, and expiresAt', async () => {
    const response = await request(app)
      .post('/files/generate-token')
      .set('Authorization', `Bearer ${jwt.sign(mockUser, 'test-secret')}`)
      .send({ fileId: 'file123', expiresIn: '10m' });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('token');
    expect(response.body).toHaveProperty('url');
    expect(response.body).toHaveProperty('expiresAt');
  });

  test('should return 400 if fileId is missing', async () => {
    const response = await request(app)
      .post('/files/generate-token')
      .set('Authorization', `Bearer ${jwt.sign(mockUser, 'test-secret')}`)
      .send({});

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Missing fileId');
  });

  test('should return 404 if file is not found', async () => {
    (FileModel.findById as jest.Mock).mockResolvedValue(null);

    const response = await request(app)
      .post('/files/generate-token')
      .set('Authorization', `Bearer ${jwt.sign(mockUser, 'test-secret')}`)
      .send({ fileId: 'file123' });

    expect(response.status).toBe(404);
    expect(response.body.error).toBe('File not found');
  });

  test('should return 403 if user is not the owner of the file', async () => {
    mockFile.userId = 'anotherUser';

    const response = await request(app)
      .post('/files/generate-token')
      .set('Authorization', `Bearer ${jwt.sign(mockUser, 'test-secret')}`)
      .send({ fileId: 'file123' });

    expect(response.status).toBe(403);
    expect(response.body.error).toBe('Forbidden');
  });
});

describe('POST /files/generate-token with responseFormat', () => {
  let mockUser: any;
  let mockFile: any;

  beforeEach(() => {
    mockUser = { id: 'user123', _id: 'user123' };
    mockFile = { _id: 'file123', path: '/tmp/file.png', userId: 'user123' };
    (FileModel.findById as jest.Mock).mockResolvedValue(mockFile);
  });

  test('should return only token when responseFormat is token', async () => {
    const response = await request(app)
      .post('/files/generate-token?responseFormat=token')
      .set('Authorization', `Bearer ${jwt.sign(mockUser, 'test-secret')}`)
      .send({ fileId: 'file123', expiresIn: '10m' });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('token');
    expect(response.body).not.toHaveProperty('url');
    expect(response.body).not.toHaveProperty('expiresAt');
  });

  test('should return only url when responseFormat is url', async () => {
    const response = await request(app)
      .post('/files/generate-token?responseFormat=url')
      .set('Authorization', `Bearer ${jwt.sign(mockUser, 'test-secret')}`)
      .send({ fileId: 'file123', expiresIn: '10m' });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('url');
    expect(response.body).not.toHaveProperty('token');
    expect(response.body).not.toHaveProperty('expiresAt');
  });

  test('should return full response when responseFormat is full', async () => {
    const response = await request(app)
      .post('/files/generate-token?responseFormat=full')
      .set('Authorization', `Bearer ${jwt.sign(mockUser, 'test-secret')}`)
      .send({ fileId: 'file123', expiresIn: '10m' });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('token');
    expect(response.body).toHaveProperty('url');
    expect(response.body).toHaveProperty('expiresAt');
  });

  test('should default to full response when responseFormat is not provided', async () => {
    const response = await request(app)
      .post('/files/generate-token')
      .set('Authorization', `Bearer ${jwt.sign(mockUser, 'test-secret')}`)
      .send({ fileId: 'file123', expiresIn: '10m' });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('token');
    expect(response.body).toHaveProperty('url');
    expect(response.body).toHaveProperty('expiresAt');
  });
});
