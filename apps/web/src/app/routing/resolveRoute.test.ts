import {
  describe,
  expect,
  it,
} from 'vitest';

import type { AppSectionValue } from '@/shared/routing';

import {
  APP_SECTIONS,
  OBJECT_HOME_SECTION,
  OBJECT_TYPES,
} from '@/shared/routing';

import { resolveRoute } from './resolveRoute';

const OBJECT_ID = 'f6000001-0000-4000-8000-000000000000';
const WAREHOUSE_ONLY: readonly AppSectionValue[] = ['warehouse'];

describe('resolveRoute', () => {
  it('reports an unknown address as not found', () => {
    expect(resolveRoute(undefined, APP_SECTIONS)).toEqual({ kind: 'not-found' });
  });

  it('redirects the empty address to the landing section', () => {
    expect(resolveRoute({ kind: 'home' }, APP_SECTIONS)).toEqual({ kind: 'redirect' });
  });

  it.each(APP_SECTIONS)('opens the available section %s', (section) => {
    expect(resolveRoute({ kind: 'section', section }, APP_SECTIONS)).toEqual({ focus: undefined, kind: 'page', section });
  });

  it('redirects a section that is not available', () => {
    expect(resolveRoute({ kind: 'section', section: 'catalog' }, WAREHOUSE_ONLY)).toEqual({ kind: 'redirect' });
  });

  it.each(OBJECT_TYPES)('opens the object of the type %s in its home section when it is available', (type) => {
    const object = { id: OBJECT_ID, type };
    const section = OBJECT_HOME_SECTION[type];

    expect(resolveRoute({ kind: 'object', object }, APP_SECTIONS)).toEqual({ focus: object, kind: 'page', section });
  });

  it.each(OBJECT_TYPES.filter(type => OBJECT_HOME_SECTION[type] !== 'warehouse'))(
    'reports the object of the type %s as unavailable when its home section is not available',
    (type) => {
      expect(resolveRoute({ kind: 'object', object: { id: OBJECT_ID, type } }, WAREHOUSE_ONLY)).toEqual({ kind: 'object-unavailable' });
    },
  );

  it('redirects a section address and still reports an unknown address as not found when no section is available', () => {
    expect(resolveRoute({ kind: 'section', section: 'network' }, [])).toEqual({ kind: 'redirect' });
    expect(resolveRoute(undefined, [])).toEqual({ kind: 'not-found' });
  });
});
