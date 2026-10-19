import {
  getPermissionName,
  listPermissionCodes,
} from '@skladburg/contracts/runtime';
import { defaultLocaleCatalog } from 'virtual:build-profile';
import {
  describe,
  expect,
  it,
} from 'vitest';

import { getPermissionMessageKey } from './getPermissionMessageKey';

const catalogTexts: ReadonlyMap<string, unknown> = new Map(Object.entries(defaultLocaleCatalog));

const getCatalogText = (key: string): string => {
  const text = catalogTexts.get(key);

  return typeof text === 'string' ? text.trim() : '';
};

describe('getPermissionMessageKey', () => {
  it.each(listPermissionCodes().map(code => [getPermissionName(code)]))('gives a named key for %s', (name) => {
    const key = getPermissionMessageKey(name);

    expect(key).toBe(`permission.${name}`);
    expect(getCatalogText(key ?? '')).not.toBe('');
  });

  it('gives no key for an unknown name', () => {
    expect(getPermissionMessageKey('no_such_permission')).toBeUndefined();
  });

  it('gives no key for an empty name', () => {
    expect(getPermissionMessageKey('')).toBeUndefined();
  });
});
