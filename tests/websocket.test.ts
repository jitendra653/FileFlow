import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { io, Socket } from 'socket.io-client';
import { Server } from 'socket.io';
import { createServer } from 'http';
import { AddressInfo } from 'net';

describe('WebSocket Integration Tests', () => {
  let clientSocket: Socket;
  let httpServer: any;
  let io: Server;
  let serverSocket: Socket;

  beforeEach((done) => {
    httpServer = createServer();
    io = new Server(httpServer);
    httpServer.listen(() => {
      const port = (httpServer.address() as AddressInfo).port;
      clientSocket = io(`http://localhost:${port}`, {
        auth: { token: 'test-token' }
      });
      io.on('connection', (socket) => {
        serverSocket = socket;
      });
      clientSocket.on('connect', done);
    });
  });

  afterEach(() => {
    if (clientSocket) {
      clientSocket.close();
    }
    if (io) {
      io.close();
    }
    if (httpServer) {
      httpServer.close();
    }
  });

  test('should authenticate with valid token', (done) => {
    clientSocket.on('connect', () => {
      expect(clientSocket.connected).toBe(true);
      done();
    });
  });

  test('should receive file upload success notification', (done) => {
    const testData = {
      fileName: 'test.jpg'
    };

    clientSocket.on('file_upload_success', (data) => {
      expect(data).toEqual(testData);
      done();
    });

    serverSocket.emit('file_upload_success', testData);
  });

  test('should receive file processing status updates', (done) => {
    const testData = {
      fileName: 'test.jpg',
      status: 'processing'
    };

    clientSocket.on('file_processing', (data) => {
      expect(data).toEqual(testData);
      done();
    });

    serverSocket.emit('file_processing', testData);
  });

  test('should receive transformation completion notification', (done) => {
    const testData = {
      fileName: 'test.jpg'
    };

    clientSocket.on('transformation_complete', (data) => {
      expect(data).toEqual(testData);
      done();
    });

    serverSocket.emit('transformation_complete', testData);
  });

  test('should handle error notifications', (done) => {
    const testError = {
      message: 'Test error message'
    };

    clientSocket.on('error', (data) => {
      expect(data).toEqual(testError);
      done();
    });

    serverSocket.emit('error', testError);
  });

  test('should handle disconnection', (done) => {
    clientSocket.on('disconnect', () => {
      expect(clientSocket.connected).toBe(false);
      done();
    });

    clientSocket.disconnect();
  });

  test('should reconnect automatically', (done) => {
    let disconnectCount = 0;
    let reconnectCount = 0;

    clientSocket.on('disconnect', () => {
      disconnectCount++;
    });

    clientSocket.on('connect', () => {
      reconnectCount++;
      if (reconnectCount === 2) {
        expect(disconnectCount).toBe(1);
        done();
      }
    });

    // Force disconnect and let it reconnect
    clientSocket.disconnect();
    setTimeout(() => {
      clientSocket.connect();
    }, 100);
  });

  test('should emit events correctly', (done) => {
    const testMessage = 'test message';

    serverSocket.on('test_event', (data) => {
      expect(data).toBe(testMessage);
      done();
    });

    clientSocket.emit('test_event', testMessage);
  });
});