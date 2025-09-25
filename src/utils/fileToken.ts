import jwt from 'jsonwebtoken';

// function createDownloadUrl(token: string) {
//   const base = process.env.BASE_URL || `http://localhost:${process.env.PORT || '3000'}`;
//   return `${base.replace(/\/$/, '')}/files/download?token=${encodeURIComponent(token)}`;
// }

export function createPreviewUrl(token: string) {
  const base = process.env.BASE_URL || `http://localhost:${process.env.PORT || '3000'}`;
  return `${base.replace(/\/$/, '')}/v1/files/preview?token=${encodeURIComponent(token)}`;
}

const FILE_SECRET = process.env.FILE_TOKEN_SECRET || 'file_secret_dev';

export interface FileTokenPayload {
  path: string;
  purpose?: 'download' | 'preview';
  iat?: number;
  exp?: number;
}

export function signFileToken(payload: FileTokenPayload, expiresIn = '5m'): string {
  return jwt.sign(payload as any, FILE_SECRET, { expiresIn });
}

export function verifyFileToken(token: string): FileTokenPayload {
  return jwt.verify(token, FILE_SECRET) as FileTokenPayload;
}

export function createDownloadUrl(token: string) {
  const base = process.env.BASE_URL || `http://localhost:${process.env.PORT || '3000'}`;
  return `${base.replace(/\/$/, '')}/v1/files/download?token=${encodeURIComponent(token)}`;
}
