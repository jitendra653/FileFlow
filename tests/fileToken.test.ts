import { signFileToken, verifyFileToken, createDownloadUrl } from '../src/utils/fileToken';

describe('fileToken utils', () => {
  test('sign and verify token', () => {
    const token = signFileToken({ path: '/tmp/file.png' }, '1h');
    const payload: any = verifyFileToken(token);
    expect(payload.path).toBe('/tmp/file.png');
  });

  test('create download url', () => {
    const token = signFileToken({ path: '/tmp/file.png' }, '1h');
    const url = createDownloadUrl(token);
    expect(url).toContain('/files/download');
    expect(url).toContain(encodeURIComponent(token));
  });
});
