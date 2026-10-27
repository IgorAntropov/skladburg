import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  addDigestMark,
  clearDigestMarks,
  createDigestMark,
  DIGEST_MARKS_STORAGE_KEY,
  hasDigestMark,
} from './digestMarks';

const createMemoryStorage = (): Storage => {
  const values = new Map<string, string>();

  return {
    clear: () => {
      values.clear();
    },
    getItem: key => values.get(key) ?? null,
    key: index => [...values.keys()].at(index) ?? null,
    get length(): number {
      return values.size;
    },
    removeItem: (key) => {
      values.delete(key);
    },
    setItem: (key, value) => {
      values.set(key, value);
    },
  };
};

const DIRECTOR = createDigestMark('user-1', 'org-1');
const CLERK = createDigestMark('user-2', 'org-1');

describe('digest marks', () => {
  it('builds a mark from the user and the organization', () => {
    expect(DIRECTOR).toBe('user-1:org-1');
    expect(DIRECTOR).not.toBe(createDigestMark('user-1', 'org-2'));
  });

  it('tells the digest once for a persona and again for another one', () => {
    const storage = createMemoryStorage();
    expect(hasDigestMark(storage, DIRECTOR)).toBe(false);

    addDigestMark(storage, DIRECTOR);

    expect(hasDigestMark(storage, DIRECTOR)).toBe(true);
    expect(hasDigestMark(storage, CLERK)).toBe(false);
  });

  it('keeps the marks of every persona told in the tab', () => {
    const storage = createMemoryStorage();
    addDigestMark(storage, DIRECTOR);
    addDigestMark(storage, CLERK);
    addDigestMark(storage, DIRECTOR);

    expect(hasDigestMark(storage, DIRECTOR)).toBe(true);
    expect(hasDigestMark(storage, CLERK)).toBe(true);
    expect(JSON.parse(storage.getItem(DIGEST_MARKS_STORAGE_KEY) ?? '[]')).toHaveLength(2);
  });

  it('tells the digest again after the marks are cleared', () => {
    const storage = createMemoryStorage();
    addDigestMark(storage, DIRECTOR);
    clearDigestMarks(storage);

    expect(hasDigestMark(storage, DIRECTOR)).toBe(false);
  });

  it('treats a broken record as no marks', () => {
    const storage = createMemoryStorage();
    storage.setItem(DIGEST_MARKS_STORAGE_KEY, '{broken');

    expect(hasDigestMark(storage, DIRECTOR)).toBe(false);

    addDigestMark(storage, DIRECTOR);

    expect(hasDigestMark(storage, DIRECTOR)).toBe(true);
  });

  it('works without a storage', () => {
    expect(hasDigestMark(undefined, DIRECTOR)).toBe(false);
    expect(() => {
      addDigestMark(undefined, DIRECTOR);
      clearDigestMarks(undefined);
    }).not.toThrow();
  });
});
