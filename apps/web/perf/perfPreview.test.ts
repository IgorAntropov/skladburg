import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  assertDocumentProtocol,
  createPreviewUrl,
  readPreviewProtocol,
} from './perfPreview.ts';

describe('readPreviewProtocol', () => {
  it('defaults to HTTP/2', () => {
    expect(readPreviewProtocol({})).toBe('h2');
    expect(readPreviewProtocol({ PERF_PREVIEW_PROTOCOL: '  ' })).toBe('h2');
  });

  it('reads either protocol regardless of case and spaces', () => {
    expect(readPreviewProtocol({ PERF_PREVIEW_PROTOCOL: ' H1 ' })).toBe('h1');
    expect(readPreviewProtocol({ PERF_PREVIEW_PROTOCOL: 'h2' })).toBe('h2');
  });

  it.each(['http2', 'https', '2'])('rejects "%s"', (value) => {
    expect(() => readPreviewProtocol({ PERF_PREVIEW_PROTOCOL: value })).toThrow(/PERF_PREVIEW_PROTOCOL/);
  });
});

describe('createPreviewUrl', () => {
  it('serves HTTP/2 over https and HTTP/1.1 over http on the same port and base path', () => {
    expect(createPreviewUrl('h2')).toBe('https://localhost:4175/skladburg/');
    expect(createPreviewUrl('h1')).toBe('http://localhost:4175/skladburg/');
  });
});

describe('assertDocumentProtocol', () => {
  it('passes when HTTP/2 was asked for and answered', () => {
    expect(() => {
      assertDocumentProtocol('h2', 'h2');
    }).not.toThrow();
  });

  it.each(['http/1.1', undefined])('fails with a clear message when HTTP/2 was asked for but the answer was %s', (protocol) => {
    expect(() => {
      assertDocumentProtocol('h2', protocol);
    }).toThrow(/needs the document over "h2"/);
  });

  it('accepts whatever protocol answered when HTTP/1.1 was asked for', () => {
    expect(() => {
      assertDocumentProtocol('h1', 'http/1.1');
    }).not.toThrow();
  });
});
