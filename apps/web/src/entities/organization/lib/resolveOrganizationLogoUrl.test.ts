import {
  describe,
  expect,
  it,
} from 'vitest';

import { resolveOrganizationLogoUrl } from './resolveOrganizationLogoUrl';

const LIGHT_PATH = 'logos/customer-1-light.svg';

const DARK_PATH = 'logos/customer-1-dark.svg';

describe('resolveOrganizationLogoUrl', () => {
  it('resolves a relative path against a base with a subpath', () => {
    expect(resolveOrganizationLogoUrl(LIGHT_PATH, 'https://example.test/skladburg/')).toBe(
      'https://example.test/skladburg/logos/customer-1-light.svg',
    );
  });

  it('resolves against a URL object base', () => {
    expect(resolveOrganizationLogoUrl(DARK_PATH, new URL('/', 'http://localhost:5173'))).toBe(
      'http://localhost:5173/logos/customer-1-dark.svg',
    );
  });

  it('keeps an absolute https address', () => {
    expect(resolveOrganizationLogoUrl('https://cdn.example.test/a.svg', 'https://example.test/skladburg/')).toBe(
      'https://cdn.example.test/a.svg',
    );
  });

  it('accepts an http address', () => {
    expect(resolveOrganizationLogoUrl('http://cdn.example.test/a.svg', 'https://example.test/')).toBe(
      'http://cdn.example.test/a.svg',
    );
  });

  it('accepts a data image', () => {
    const dataUrl = 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=';

    expect(resolveOrganizationLogoUrl(dataUrl, 'https://example.test/')).toBe(dataUrl);
  });

  it('rejects a data address that is not an image', () => {
    expect(resolveOrganizationLogoUrl('data:text/html,<p>x</p>', 'https://example.test/')).toBeUndefined();
  });

  it('rejects an empty path', () => {
    expect(resolveOrganizationLogoUrl('', 'https://example.test/')).toBeUndefined();
    expect(resolveOrganizationLogoUrl('   ', 'https://example.test/')).toBeUndefined();
  });

  it('rejects other schemes', () => {
    expect(resolveOrganizationLogoUrl('javascript:alert(1)', 'https://example.test/')).toBeUndefined();
    expect(resolveOrganizationLogoUrl('blob:https://example.test/1', 'https://example.test/')).toBeUndefined();
    expect(resolveOrganizationLogoUrl('file:///etc/passwd', 'https://example.test/')).toBeUndefined();
  });

  it('rejects an address that does not parse', () => {
    expect(resolveOrganizationLogoUrl('http://', 'https://example.test/')).toBeUndefined();
    expect(resolveOrganizationLogoUrl('logo.svg', 'not a base')).toBeUndefined();
  });
});
