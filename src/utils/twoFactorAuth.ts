// --- Async Patterns Reference Examples ---

// 1. Callback function example
function doAsyncWithCallback(input: string, callback: (err: Error | null, result?: string) => void) {
  setTimeout(() => {
    if (input === 'fail') {
      callback(new Error('Callback error!'));
    } else {
      callback(null, `Callback result: ${input}`);
    }
  }, 100);
}

// 2. Promise example
function doAsyncWithPromise(input: string): Promise<string> {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (input === 'fail') {
        reject(new Error('Promise error!'));
      } else {
        resolve(`Promise result: ${input}`);
      }
    }, 100);
  });
}

// 3. Async/await example
async function doAsyncWithAwait(input: string): Promise<string> {
  // This function just wraps the Promise example
  return await doAsyncWithPromise(input);
}

// 4. Error handling in async code
async function demoAsyncErrorHandling() {
  try {
    const result = await doAsyncWithAwait('ok');
    logger.info('Async/await success', { result });
  } catch (err) {
    logger.error('Async/await error', { error: err });
  }

  doAsyncWithCallback('fail', (err, result) => {
    if (err) {
      logger.error('Callback error', { error: err });
    } else {
      logger.info('Callback success', { result });
    }
  });

  doAsyncWithPromise('fail')
    .then(result => logger.info('Promise success', { result }))
    .catch(err => logger.error('Promise error', { error: err }));
}

// Uncomment to run demo
// demoAsyncErrorHandling();
import { authenticator } from 'otplib';
import qrcode from 'qrcode';
import crypto from 'crypto';
import { IUser } from '../models/user';
import logger from './logger';

const APP_NAME = 'FileFlow Project';

interface TOTPConfig {
  secret: string;
  qrCodeUrl: string;
  backupCodes: string[];
}

export const generateTOTPConfig = async (user: IUser): Promise<TOTPConfig> => {
  try {
    // Generate TOTP secret
    const secret = authenticator.generateSecret();
    
    // Generate QR code for easy setup
    const otpauth = authenticator.keyuri(
      user.email,
      APP_NAME,
      secret
    );
    
    const qrCodeUrl = await qrcode.toDataURL(otpauth);
    
    // Generate backup codes (10 codes, 8 characters each)
    const backupCodes = Array.from({ length: 10 }, () =>
      crypto.randomBytes(4).toString('hex')
    );

    return {
      secret,
      qrCodeUrl,
      backupCodes
    };
  } catch (error) {
    logger.error('Error generating TOTP config:', error);
    throw error;
  }
};

export const verifyTOTP = (token: string, secret: string): boolean => {
  try {
    return authenticator.verify({ token, secret });
  } catch (error) {
    logger.error('Error verifying TOTP:', error);
    return false;
  }
};

export const verifyBackupCode = async (
  code: string,
  user: IUser
): Promise<boolean> => {
  try {
    const backupCodes = user.securitySettings?.twoFactorAuth?.backupCodes || [];
    const codeIndex = backupCodes.indexOf(code);
    
    if (codeIndex === -1) {
      return false;
    }

    // Remove the used backup code
    backupCodes.splice(codeIndex, 1);
    user.securitySettings!.twoFactorAuth!.backupCodes = backupCodes;
    await user.save();

    return true;
  } catch (error) {
    logger.error('Error verifying backup code:', error);
    return false;
  }
};

export const generateNewBackupCodes = (): string[] => {
  return Array.from({ length: 10 }, () =>
    crypto.randomBytes(4).toString('hex')
  );
};