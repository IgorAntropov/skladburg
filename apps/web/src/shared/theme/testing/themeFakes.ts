export interface FakeStorageOptionsValue {
  initial?: Readonly<Record<string, string>>;
  isGetFailing?: boolean;
  isSetFailing?: boolean;
}

export interface IFakeStorage extends Storage {
  readonly values: Map<string, string>;
}

export const createFakeStorage = ({
  initial = {},
  isGetFailing = false,
  isSetFailing = false,
}: FakeStorageOptionsValue = {}): IFakeStorage => {
  const values = new Map<string, string>(Object.entries(initial));

  return {
    clear: () => {
      values.clear();
    },
    getItem: (key) => {
      if (isGetFailing) {
        throw new DOMException('access denied', 'SecurityError');
      }

      return values.get(key) ?? null;
    },
    key: index => [...values.keys()][index] ?? null,
    get length() {
      return values.size;
    },
    removeItem: (key) => {
      values.delete(key);
    },
    setItem: (key, value) => {
      if (isSetFailing) {
        throw new DOMException('quota exceeded', 'QuotaExceededError');
      }

      values.set(key, value);
    },
    values,
  };
};

export class FakeMediaQueryList extends EventTarget implements MediaQueryList {
  matches: boolean;
  media = '(prefers-color-scheme: dark)';
  onchange = null;

  constructor(matches: boolean) {
    super();
    this.matches = matches;
  }

  addListener(): void {
    throw new Error('deprecated api is not used');
  }

  change(matches: boolean): void {
    this.matches = matches;
    this.dispatchEvent(new Event('change'));
  }

  removeListener(): void {
    throw new Error('deprecated api is not used');
  }
}

export class FakeStorageEvents extends EventTarget {
  emit(key: null | string, newValue: null | string, storageArea: null | Storage): void {
    this.dispatchEvent(Object.assign(new Event('storage'), { key, newValue, storageArea }));
  }
}
