import {
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import type { PerfTlsToolsValue } from './perfTls.ts';

import {
  buildOpensslArguments,
  buildSpkiTrustArgument,
  planPerfTls,
  resolvePerfTls,
} from './perfTls.ts';

const createTools = (overrides: Partial<PerfTlsToolsValue> = {}): PerfTlsToolsValue => ({
  hasFile: vi.fn(() => false),
  makeDirectory: vi.fn(),
  runOpenssl: vi.fn(),
  ...overrides,
});

describe('planPerfTls', () => {
  it('takes the certificate pair from the environment when both variables are set', () => {
    expect(planPerfTls({ DEV_HTTPS_CERT_FILE: '/c/dev.pem', DEV_HTTPS_KEY_FILE: '/c/dev-key.pem' })).toEqual({
      files: { certFile: '/c/dev.pem', keyFile: '/c/dev-key.pem' },
      kind: 'environment',
    });
  });

  it('asks for a generated certificate when the variables are unset or blank', () => {
    expect(planPerfTls({})).toEqual({ kind: 'generate' });
    expect(planPerfTls({ DEV_HTTPS_CERT_FILE: '', DEV_HTTPS_KEY_FILE: ' ' })).toEqual({ kind: 'generate' });
  });

  it('names the missing variable when only one is set', () => {
    expect(() => planPerfTls({ DEV_HTTPS_CERT_FILE: '/c/dev.pem' })).toThrow(/DEV_HTTPS_KEY_FILE is required/);
    expect(() => planPerfTls({ DEV_HTTPS_KEY_FILE: '/c/dev-key.pem' })).toThrow(/DEV_HTTPS_CERT_FILE is required/);
  });
});

describe('resolvePerfTls', () => {
  it('does not call openssl when the environment carries the pair', () => {
    const tools = createTools();
    const files = resolvePerfTls({
      directory: '/t',
      env: { DEV_HTTPS_CERT_FILE: '/c/dev.pem', DEV_HTTPS_KEY_FILE: '/c/dev-key.pem' },
      tools,
    });

    expect(files).toEqual({ certFile: '/c/dev.pem', keyFile: '/c/dev-key.pem' });
    expect(tools.runOpenssl).not.toHaveBeenCalled();
  });

  it('generates a pair into the directory with openssl when nothing is set', () => {
    const tools = createTools();
    const files = resolvePerfTls({ directory: '/t/tls', env: {}, tools });

    expect(files).toEqual({ certFile: '/t/tls/perf-preview.pem', keyFile: '/t/tls/perf-preview-key.pem' });
    expect(tools.makeDirectory).toHaveBeenCalledWith('/t/tls');
    expect(tools.runOpenssl).toHaveBeenCalledWith(buildOpensslArguments(files));
  });

  it('reuses a pair that is already on disk', () => {
    const tools = createTools({ hasFile: vi.fn(() => true) });

    resolvePerfTls({ directory: '/t/tls', env: {}, tools });

    expect(tools.runOpenssl).not.toHaveBeenCalled();
  });

  it('explains how to continue when openssl is missing', () => {
    const missing = Object.assign(new Error('spawn openssl ENOENT'), { code: 'ENOENT' });
    const tools = createTools({
      runOpenssl: vi.fn(() => {
        throw missing;
      }),
    });

    expect(() => resolvePerfTls({ directory: '/t/tls', env: {}, tools })).toThrow(
      /"openssl" command is not installed.*DEV_HTTPS_CERT_FILE.*PERF_PREVIEW_PROTOCOL=h1/s,
    );
  });

  it('reports an openssl failure with its reason', () => {
    const tools = createTools({
      runOpenssl: vi.fn(() => {
        throw new Error('bad config');
      }),
    });

    expect(() => resolvePerfTls({ directory: '/t/tls', env: {}, tools })).toThrow(/"openssl" failed: Error: bad config/);
  });
});

describe('buildOpensslArguments', () => {
  it('issues a self-signed certificate for localhost into the given files', () => {
    const args = buildOpensslArguments({ certFile: '/t/c.pem', keyFile: '/t/k.pem' });

    expect(args).toEqual(expect.arrayContaining(['-x509', '-nodes', '/CN=localhost']));
    expect(args[args.indexOf('-keyout') + 1]).toBe('/t/k.pem');
    expect(args[args.indexOf('-out') + 1]).toBe('/t/c.pem');
  });
});

const PUBLIC_TEST_CERTIFICATE = [
  '-----BEGIN CERTIFICATE-----',
  'MIIBgDCCASWgAwIBAgIUTI7cwGWKftztn+tQA1vd82UJdBQwCgYIKoZIzj0EAwIw',
  'FDESMBAGA1UEAwwJbG9jYWxob3N0MCAXDTI2MTAxNjA3MTY0MFoYDzIxMjYwOTIy',
  'MDcxNjQwWjAUMRIwEAYDVQQDDAlsb2NhbGhvc3QwWTATBgcqhkjOPQIBBggqhkjO',
  'PQMBBwNCAAQJ0NdiyL5T3wgBa31dXLoJsQtWiXcX4YWpaDddfT6+twR8NRvWA+M3',
  'prh7GmyKDCxKML855dsBJmXeZ4JdEUuao1MwUTAdBgNVHQ4EFgQU3PSeSRkIvtsB',
  'Z4t2qm2Yhw2LrR0wHwYDVR0jBBgwFoAU3PSeSRkIvtsBZ4t2qm2Yhw2LrR0wDwYD',
  'VR0TAQH/BAUwAwEB/zAKBggqhkjOPQQDAgNJADBGAiEAsKrwrI+m/irr8/5+OQ+g',
  'FSb6Jgps1ySDvrloVjA7PlICIQDR9ARyI7tKzX7+8G2XrbdnKjPHeJhlvQCRGmty',
  'v4zFZQ==',
  '-----END CERTIFICATE-----',
].join('\n');

describe('buildSpkiTrustArgument', () => {
  it('trusts the certificate by the SHA-256 of its public key, the way openssl computes it', () => {
    expect(buildSpkiTrustArgument(PUBLIC_TEST_CERTIFICATE)).toBe(
      '--ignore-certificate-errors-spki-list=T+TR5c+/TCf+yuHo6V+TkZ9x47iJDAU3l2YcrhWYlaw=',
    );
  });

  it('rejects a file that is not a certificate', () => {
    expect(() => buildSpkiTrustArgument('not a certificate')).toThrow();
  });
});
