import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest';

import { bindThemeToDocument } from './bindThemeToDocument';
import { createThemePreferenceStore } from './createThemePreferenceStore';
import { FakeMediaQueryList } from './testing/themeFakes';

describe('bindThemeToDocument', () => {
  let root: HTMLElement = document.documentElement;

  beforeEach(() => {
    root = document.createElement('div');
  });

  afterEach(() => {
    root.remove();
  });

  it('puts the resolved theme on the root element immediately', () => {
    const store = createThemePreferenceStore({ colorSchemeQuery: undefined, storage: undefined, storageEvents: undefined });
    store.setPreference('dark');

    bindThemeToDocument(store, root);

    expect(root.dataset.theme).toBe('dark');
    expect(root.style.colorScheme).toBe('dark');
  });

  it('never puts the system preference into the document', () => {
    const query = new FakeMediaQueryList(true);
    const store = createThemePreferenceStore({ colorSchemeQuery: query, storage: undefined, storageEvents: undefined });
    store.setPreference('system');

    bindThemeToDocument(store, root);

    expect(root.dataset.theme).toBe('dark');

    query.change(false);

    expect(root.dataset.theme).toBe('light');
    expect(root.style.colorScheme).toBe('light');
  });

  it('repeats on every change of the theme', () => {
    const store = createThemePreferenceStore({ colorSchemeQuery: undefined, storage: undefined, storageEvents: undefined });
    bindThemeToDocument(store, root);

    store.setPreference('dark');

    expect(root.dataset.theme).toBe('dark');
    expect(root.style.colorScheme).toBe('dark');

    store.setPreference('light');

    expect(root.dataset.theme).toBe('light');
    expect(root.style.colorScheme).toBe('light');
  });

  it('stops following the store after the returned unsubscribe', () => {
    const store = createThemePreferenceStore({ colorSchemeQuery: undefined, storage: undefined, storageEvents: undefined });
    const unbind = bindThemeToDocument(store, root);

    unbind();
    store.setPreference('dark');

    expect(root.dataset.theme).toBe('light');
  });
});
