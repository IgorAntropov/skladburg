import {
  describe,
  expect,
  it,
} from 'vitest';

import type { ObjectTypeValue } from '@/shared/routing';

import {
  APP_SECTIONS,
  OBJECT_HOME_SECTION,
  OBJECT_TYPES,
} from '@/shared/routing';

import {
  getAddressSection,
  SECTION_TITLE_KEYS,
} from './sections';

const OBJECT_ID = 'f6000001-0000-4000-8000-000000000000';

describe('getAddressSection', () => {
  it.each(APP_SECTIONS)('returns the section of the section address %s', (section) => {
    expect(getAddressSection({ kind: 'section', section })).toBe(section);
  });

  it.each(OBJECT_TYPES)('returns the home section of the object type %s', (type: ObjectTypeValue) => {
    expect(getAddressSection({ kind: 'object', object: { id: OBJECT_ID, type } })).toBe(OBJECT_HOME_SECTION[type]);
  });

  it('has no section for the empty address', () => {
    expect(getAddressSection({ kind: 'home' })).toBeUndefined();
  });
});

describe('section constants', () => {
  it('has a title key for every section', () => {
    expect(Object.keys(SECTION_TITLE_KEYS).sort()).toEqual([...APP_SECTIONS].sort());
  });
});
