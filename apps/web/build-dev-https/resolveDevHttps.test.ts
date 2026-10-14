import {
  describe,
  expect,
  it,
} from 'vitest';

import { resolveDevHttps } from './resolveDevHttps.ts';

const CERT_PATH = '/certs/dev.pem';

const KEY_PATH = '/certs/dev-key.pem';

const FILES: Readonly<Record<string, Buffer>> = {
  [CERT_PATH]: Buffer.from('certificate'),
  [KEY_PATH]: Buffer.from('private key'),
};

const readFromFiles = (path: string): Buffer => {
  const content = FILES[path];

  if (content === undefined) {
    throw new Error(`ENOENT: ${path}`);
  }

  return content;
};

const captureError = (action: () => unknown): Error | undefined => {
  try {
    action();
  }
  catch (error) {
    return error instanceof Error ? error : undefined;
  }

  return undefined;
};

describe('resolveDevHttps', () => {
  it('returns undefined when neither variable is set', () => {
    expect(resolveDevHttps({}, readFromFiles)).toBeUndefined();
  });

  it('returns undefined when both variables are empty strings', () => {
    const env = { DEV_HTTPS_CERT_FILE: '', DEV_HTTPS_KEY_FILE: '' };

    expect(resolveDevHttps(env, readFromFiles)).toBeUndefined();
  });

  it('does not read any file when neither variable is set', () => {
    const readPaths: string[] = [];

    resolveDevHttps({}, (path) => {
      readPaths.push(path);

      return Buffer.alloc(0);
    });

    expect(readPaths).toEqual([]);
  });

  it('names the key variable when only the certificate is set', () => {
    const env = { DEV_HTTPS_CERT_FILE: CERT_PATH };

    expect(() => resolveDevHttps(env, readFromFiles)).toThrow('DEV_HTTPS_KEY_FILE');
  });

  it('names the certificate variable when only the key is set', () => {
    const env = { DEV_HTTPS_KEY_FILE: KEY_PATH };

    expect(() => resolveDevHttps(env, readFromFiles)).toThrow('DEV_HTTPS_CERT_FILE');
  });

  it('treats an empty variable as missing', () => {
    const env = { DEV_HTTPS_CERT_FILE: CERT_PATH, DEV_HTTPS_KEY_FILE: '' };

    expect(() => resolveDevHttps(env, readFromFiles)).toThrow('DEV_HTTPS_KEY_FILE');
  });

  it('reads the certificate and the key from the given paths', () => {
    const env = { DEV_HTTPS_CERT_FILE: CERT_PATH, DEV_HTTPS_KEY_FILE: KEY_PATH };

    expect(resolveDevHttps(env, readFromFiles)).toEqual({
      cert: FILES[CERT_PATH],
      key: FILES[KEY_PATH],
    });
  });

  it('names the variable and the path when the certificate cannot be read', () => {
    const env = { DEV_HTTPS_CERT_FILE: '/missing/dev.pem', DEV_HTTPS_KEY_FILE: KEY_PATH };

    expect(() => resolveDevHttps(env, readFromFiles)).toThrow(/DEV_HTTPS_CERT_FILE.*\/missing\/dev\.pem/);
  });

  it('names the variable and the path when the key cannot be read', () => {
    const env = { DEV_HTTPS_CERT_FILE: CERT_PATH, DEV_HTTPS_KEY_FILE: '/missing/dev-key.pem' };

    expect(() => resolveDevHttps(env, readFromFiles)).toThrow(/DEV_HTTPS_KEY_FILE.*\/missing\/dev-key\.pem/);
  });

  it('keeps the original read error as the cause', () => {
    const env = { DEV_HTTPS_CERT_FILE: '/missing/dev.pem', DEV_HTTPS_KEY_FILE: KEY_PATH };

    const thrown = captureError(() => resolveDevHttps(env, readFromFiles));

    expect(thrown?.cause).toEqual(new Error('ENOENT: /missing/dev.pem'));
  });
});
