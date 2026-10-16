import { runInNewContext } from 'node:vm';
import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  createDeferredPreloadScript,
  createEntryScriptSelector,
  createLinkSelector,
} from './createDeferredPreloadScript.ts';

interface FakeElementValue {
  addEventListener: (type: string, listener: ListenerValue) => void;
  address: string;
  listeners: Record<string, ListenerValue[]>;
  sheet?: null | object;
  tag: string;
}

interface FakeLinkValue {
  crossOrigin?: string;
  fetchPriority?: string;
  href?: string;
  rel?: string;
}

type ListenerValue = () => void;

interface PageElementValue {
  address: string;
  isLoaded?: boolean;
  tag: 'link' | 'script';
}

interface RunOptionsValue {
  isDocumentBroken?: boolean;
  pageElements?: PageElementValue[];
}

interface RunResultValue {
  appended: FakeLinkValue[];
  dispatch: (address: string, type: string) => void;
  listenerTypes: string[];
}

const ENTRY_SRC = '/skladburg/assets/index-BtccsYqy.js';

const STYLESHEET_HREF = '/skladburg/assets/index-Cx81Lk2m.css';

const MOUNT_PRELOAD_HREF = '/skladburg/assets/mountApp-Dq3Zr7aa.js';

const HREFS = ['/skladburg/assets/worker-XkuRDHIr.js', '/skladburg/assets/engine-BgAsrCdG.js'];

const MAX_SCRIPT_BYTES = 600;

const SELECTOR_PATTERN = /^(link|script)\[(?:href|src)=("(?:[^"\\]|\\.)*")\]$/;

const ENTRY_SELECTOR = createEntryScriptSelector(ENTRY_SRC);

const STYLESHEET_SELECTOR = createLinkSelector(STYLESHEET_HREF);

const MOUNT_PRELOAD_SELECTOR = createLinkSelector(MOUNT_PRELOAD_HREF);

const PAGE: PageElementValue[] = [
  { address: STYLESHEET_HREF, tag: 'link' },
  { address: MOUNT_PRELOAD_HREF, tag: 'link' },
  { address: ENTRY_SRC, tag: 'script' },
];

const createFakeElement = ({ address, isLoaded = false, tag }: PageElementValue): FakeElementValue => {
  const listeners: Record<string, ListenerValue[]> = {};

  return {
    addEventListener: (type, listener) => {
      listeners[type] = [...listeners[type] ?? [], listener];
    },
    address,
    listeners,
    ...tag === 'link' ? { sheet: isLoaded ? {} : null } : {},
    tag,
  };
};

const runScript = (script: string, options: RunOptionsValue = {}): RunResultValue => {
  const { isDocumentBroken = false, pageElements = PAGE } = options;
  const elements = pageElements.map(createFakeElement);
  const appended: FakeLinkValue[] = [];
  const document = {
    createElement: (): FakeLinkValue => ({}),
    head: {
      appendChild: (link: FakeLinkValue): void => {
        appended.push(link);
      },
    },
    querySelector: (selector: string): FakeElementValue | null => {
      if (isDocumentBroken) {
        throw new Error('The document is broken');
      }

      const match = SELECTOR_PATTERN.exec(selector);
      const address: unknown = match?.[2] === undefined ? undefined : JSON.parse(match[2]);

      return elements.find(candidate => candidate.tag === match?.[1] && candidate.address === address) ?? null;
    },
  };

  runInNewContext(script, { document });

  return {
    appended,
    dispatch: (address, type) => {
      for (const listener of elements.find(candidate => candidate.address === address)?.listeners[type] ?? []) {
        listener();
      }
    },
    listenerTypes: elements.flatMap(candidate => Object.keys(candidate.listeners)),
  };
};

const createScript = (triggerSelectors: readonly string[]): string =>
  createDeferredPreloadScript({ hrefs: HREFS, triggerSelectors });

const createStylesheetOrEntryScript = (): string => createScript([STYLESHEET_SELECTOR, ENTRY_SELECTOR]);

const EXPECTED_LINKS: FakeLinkValue[] = [
  { crossOrigin: '', href: HREFS[0], rel: 'modulepreload' },
  { crossOrigin: '', href: HREFS[1], rel: 'modulepreload' },
];

describe('createDeferredPreloadScript', () => {
  it('inserts nothing while no trigger has loaded', () => {
    const result = runScript(createStylesheetOrEntryScript());

    expect(result.listenerTypes).toEqual(['load', 'load']);
    expect(result.appended).toEqual([]);
  });

  it('inserts a module preload link for every address in order when the stylesheet has loaded', () => {
    const result = runScript(createStylesheetOrEntryScript());

    result.dispatch(STYLESHEET_HREF, 'load');

    expect(result.appended).toEqual(EXPECTED_LINKS);
  });

  it('inserts the links when the entry script has loaded before the stylesheet', () => {
    const result = runScript(createStylesheetOrEntryScript());

    result.dispatch(ENTRY_SRC, 'load');

    expect(result.appended).toEqual(EXPECTED_LINKS);
  });

  it('inserts the links once when the stylesheet and then the entry script load', () => {
    const result = runScript(createStylesheetOrEntryScript());

    result.dispatch(STYLESHEET_HREF, 'load');
    result.dispatch(ENTRY_SRC, 'load');

    expect(result.appended).toHaveLength(HREFS.length);
  });

  it('inserts the links once however many times one trigger reports loading', () => {
    const result = runScript(createStylesheetOrEntryScript());

    result.dispatch(ENTRY_SRC, 'load');
    result.dispatch(ENTRY_SRC, 'load');
    result.dispatch(STYLESHEET_HREF, 'load');

    expect(result.appended).toHaveLength(HREFS.length);
  });

  it('inserts the links at once when the stylesheet is already loaded from the cache', () => {
    const result = runScript(createStylesheetOrEntryScript(), {
      pageElements: [{ address: STYLESHEET_HREF, isLoaded: true, tag: 'link' }, { address: ENTRY_SRC, tag: 'script' }],
    });

    expect(result.appended).toEqual(EXPECTED_LINKS);

    result.dispatch(ENTRY_SRC, 'load');

    expect(result.appended).toHaveLength(HREFS.length);
  });

  it('does not insert at once while the stylesheet has not loaded yet', () => {
    const result = runScript(createStylesheetOrEntryScript(), {
      pageElements: [{ address: STYLESHEET_HREF, isLoaded: false, tag: 'link' }, { address: ENTRY_SRC, tag: 'script' }],
    });

    expect(result.appended).toEqual([]);
  });

  it('inserts nothing when the stylesheet and the entry script both fail', () => {
    const result = runScript(createStylesheetOrEntryScript());

    result.dispatch(STYLESHEET_HREF, 'error');
    result.dispatch(ENTRY_SRC, 'error');

    expect(result.appended).toEqual([]);
  });

  it('inserts the links when the entry script loads after the stylesheet failed', () => {
    const result = runScript(createStylesheetOrEntryScript());

    result.dispatch(STYLESHEET_HREF, 'error');
    result.dispatch(ENTRY_SRC, 'load');

    expect(result.appended).toEqual(EXPECTED_LINKS);
  });

  it('waits for the entry script only when it is the only trigger', () => {
    const result = runScript(createScript([ENTRY_SELECTOR]));

    expect(result.listenerTypes).toEqual(['load']);

    result.dispatch(STYLESHEET_HREF, 'load');

    expect(result.appended).toEqual([]);

    result.dispatch(ENTRY_SRC, 'load');

    expect(result.appended).toEqual(EXPECTED_LINKS);
  });

  it('inserts the links when the module preload of the point loads before the entry script', () => {
    const result = runScript(createScript([MOUNT_PRELOAD_SELECTOR, ENTRY_SELECTOR]));

    result.dispatch(MOUNT_PRELOAD_HREF, 'load');

    expect(result.appended).toEqual(EXPECTED_LINKS);

    result.dispatch(ENTRY_SRC, 'load');

    expect(result.appended).toHaveLength(HREFS.length);
  });

  it('inserts the links when the entry script loads and the module preload of the point fails', () => {
    const result = runScript(createScript([MOUNT_PRELOAD_SELECTOR, ENTRY_SELECTOR]));

    result.dispatch(MOUNT_PRELOAD_HREF, 'error');

    expect(result.appended).toEqual([]);

    result.dispatch(ENTRY_SRC, 'load');

    expect(result.appended).toEqual(EXPECTED_LINKS);
  });

  it('keeps the normal fetch priority of the links', () => {
    const result = runScript(createStylesheetOrEntryScript());

    result.dispatch(STYLESHEET_HREF, 'load');

    expect(result.appended.every(link => link.fetchPriority === undefined)).toBe(true);
  });

  it('waits only for the elements with the exact address and the right tag', () => {
    const result = runScript(createStylesheetOrEntryScript(), {
      pageElements: [
        { address: '/skladburg/assets/other.css', tag: 'link' },
        { address: STYLESHEET_HREF, tag: 'script' },
        { address: ENTRY_SRC, tag: 'script' },
      ],
    });

    expect(result.listenerTypes).toEqual(['load']);
  });

  it('still waits for the entry script when the page has no stylesheet', () => {
    const result = runScript(createStylesheetOrEntryScript(), { pageElements: [{ address: ENTRY_SRC, tag: 'script' }] });

    expect(result.listenerTypes).toEqual(['load']);

    result.dispatch(ENTRY_SRC, 'load');

    expect(result.appended).toEqual(EXPECTED_LINKS);
  });

  it('does nothing when the page has none of the triggers', () => {
    const result = runScript(createStylesheetOrEntryScript(), { pageElements: [] });

    expect(result.listenerTypes).toEqual([]);
    expect(result.appended).toEqual([]);
  });

  it('does not throw when the document fails', () => {
    expect(() => runScript(createStylesheetOrEntryScript(), { isDocumentBroken: true })).not.toThrow();
  });

  it('puts the addresses under any base of the build', () => {
    const src = './assets/index-a.js';
    const css = './assets/index-a.css';
    const result = runScript(
      createDeferredPreloadScript({
        hrefs: ['./assets/engine-b.js'],
        triggerSelectors: [createLinkSelector(css), createEntryScriptSelector(src)],
      }),
      { pageElements: [{ address: css, tag: 'link' }, { address: src, tag: 'script' }] },
    );

    result.dispatch(css, 'load');

    expect(result.appended).toEqual([{ crossOrigin: '', href: './assets/engine-b.js', rel: 'modulepreload' }]);
  });

  it.each([
    ['the entry script', [ENTRY_SELECTOR]],
    ['the stylesheet or the entry script', [STYLESHEET_SELECTOR, ENTRY_SELECTOR]],
    ['the module preload of the point or the entry script', [MOUNT_PRELOAD_SELECTOR, ENTRY_SELECTOR]],
  ])('holds the size of the script waiting for %s under the limit', (_name, selectors) => {
    expect(Buffer.byteLength(createScript(selectors))).toBeLessThanOrEqual(MAX_SCRIPT_BYTES);
  });

  it('is plain old syntax without anything that could close the script of the page early', () => {
    const script = createDeferredPreloadScript({
      hrefs: ['/a/</script>.js'],
      triggerSelectors: [createEntryScriptSelector('/a/<b>.js'), createLinkSelector('/a/<!--.css')],
    });

    expect(script).not.toMatch(/\b(?:const|let)\b|=>|`/);
    expect(script).not.toContain('</');
    expect(script).not.toContain('<!--');
  });
});

describe('createEntryScriptSelector', () => {
  it('quotes the address so that any character of it stays inside the value', () => {
    expect(createEntryScriptSelector('/a"b/c.js')).toBe('script[src="/a\\"b/c.js"]');
  });
});

describe('createLinkSelector', () => {
  it('quotes the address so that any character of it stays inside the value', () => {
    expect(createLinkSelector('/a"b/c.css')).toBe('link[href="/a\\"b/c.css"]');
  });
});
