import request from 'supertest';
import { app } from '../src/server';
import FileModel from '../src/models/file';
import logger from '../src/utils/logger';
import jwt from 'jsonwebtoken';

jest.mock('../src/models/file');
jest.mock('../src/utils/logger');

describe('POST /v1/files/generate-token - Error Logging', () => {
  let mockUser: any;
  let mockFile: any;

  beforeEach(() => {
    mockUser = { id: 'user123', _id: 'user123' };
    mockFile = { _id: 'file123', path: '/tmp/file.png', userId: 'user123' };
    (FileModel.findById as jest.Mock).mockResolvedValue(mockFile);
  });

  test('should log validation errors for missing fileId', async () => {
    await request(app)
      .post('/v1/files/generate-token')
      .set('Authorization', `Bearer ${jwt.sign(mockUser, 'test-secret')}`)
      .send({ expiresIn: '10m' });

    expect(logger.warn).toHaveBeenCalledWith(
      'Validation failed for /generate-token',
      expect.objectContaining({ errors: expect.any(Array) })
    );
  });

  test('should log unauthorized access attempts', async () => {
    mockFile.userId = 'anotherUser';

    await request(app)
      .post('/v1/files/generate-token')
      .set('Authorization', `Bearer ${jwt.sign(mockUser, 'test-secret')}`)
      .send({ fileId: 'file123', expiresIn: '10m' });

    expect(logger.warn).toHaveBeenCalledWith(
      `Unauthorized access attempt by user: ${mockUser.id}`
    );
  });

  test('should log file not found errors', async () => {
    (FileModel.findById as jest.Mock).mockResolvedValue(null);

    await request(app)
      .post('/v1/files/generate-token')
      .set('Authorization', `Bearer ${jwt.sign(mockUser, 'test-secret')}`)
      .send({ fileId: 'file123', expiresIn: '10m' });

    expect(logger.warn).toHaveBeenCalledWith(
      'File not found for fileId: file123'
    );
  });

  test('should log internal server errors', async () => {
    (FileModel.findById as jest.Mock).mockImplementation(() => {
      throw new Error('Database error');
    });

    await request(app)
      .post('/v1/files/generate-token')
      .set('Authorization', `Bearer ${jwt.sign(mockUser, 'test-secret')}`)
      .send({ fileId: 'file123', expiresIn: '10m' });

    expect(logger.error).toHaveBeenCalledWith(
      'Error in /generate-token endpoint',
      expect.objectContaining({ error: expect.any(Error) })
    );
  });
});
