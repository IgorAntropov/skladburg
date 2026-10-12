import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest';

import { bindThemeToDocument } from './bindThemeToDocument';
import { createThemePreferenceStore } from './createThemePreferenceStore';
import {
  createFakeThemeTransitions,
  FakeMediaQueryList,
} from './testing/themeFakes';

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

  describe('smooth change', () => {
    const createStore = (): ReturnType<typeof createThemePreferenceStore> => {
      return createThemePreferenceStore({ colorSchemeQuery: undefined, storage: undefined, storageEvents: undefined });
    };

    it('puts the theme at the start without any transition', () => {
      const transitions = createFakeThemeTransitions();
      const store = createStore();
      store.setPreference('dark');

      bindThemeToDocument(store, root, transitions);

      expect(root.dataset.theme).toBe('dark');
      expect(transitions.startedCount).toBe(0);
    });

    it('changes the theme inside one view transition when the browser can and motion is allowed', () => {
      const transitions = createFakeThemeTransitions();
      const store = createStore();
      bindThemeToDocument(store, root, transitions);

      store.setPreference('dark');

      expect(transitions.startedCount).toBe(1);
      expect(root.dataset.theme).toBe('light');

      transitions.finishAll();

      expect(root.dataset.theme).toBe('dark');
      expect(root.style.colorScheme).toBe('dark');
    });

    it('takes the latest theme when several changes happen before the transition updates the page', () => {
      const transitions = createFakeThemeTransitions();
      const store = createStore();
      bindThemeToDocument(store, root, transitions);

      store.setPreference('dark');
      store.setPreference('light');
      transitions.finishAll();

      expect(root.dataset.theme).toBe('light');
      expect(root.style.colorScheme).toBe('light');
    });

    it('changes the theme at once when the browser has no view transitions', () => {
      const transitions = createFakeThemeTransitions({ isApiAvailable: false });
      const store = createStore();
      bindThemeToDocument(store, root, transitions);

      store.setPreference('dark');

      expect(root.dataset.theme).toBe('dark');
      expect(root.style.colorScheme).toBe('dark');
      expect(transitions.startedCount).toBe(0);
    });

    it('changes the theme at once when the user asks for less motion', () => {
      const transitions = createFakeThemeTransitions({ isMotionAllowed: false });
      const store = createStore();
      bindThemeToDocument(store, root, transitions);

      store.setPreference('dark');

      expect(root.dataset.theme).toBe('dark');
      expect(transitions.startedCount).toBe(0);
    });

    it('follows the system theme through a transition as well', () => {
      const transitions = createFakeThemeTransitions();
      const query = new FakeMediaQueryList(false);
      const store = createThemePreferenceStore({ colorSchemeQuery: query, storage: undefined, storageEvents: undefined });
      store.setPreference('system');
      bindThemeToDocument(store, root, transitions);

      query.change(true);
      transitions.finishAll();

      expect(transitions.startedCount).toBe(1);
      expect(root.dataset.theme).toBe('dark');
    });

    it('starts no transition after the returned unsubscribe', () => {
      const transitions = createFakeThemeTransitions();
      const store = createStore();
      const unbind = bindThemeToDocument(store, root, transitions);

      unbind();
      store.setPreference('dark');

      expect(transitions.startedCount).toBe(0);
    });
  });
});
