import { runInNewContext } from 'node:vm';
import {
  describe,
  expect,
  it,
} from 'vitest';

import { createBootFallbackScript } from './createBootFallbackScript.ts';

interface FakeBarValue {
  hidden: boolean;
}

interface FakeBlockValue {
  attributes: Record<string, string>;
  hidden: boolean;
}

interface FakeEventValue {
  target: unknown;
}

interface RunOptionsValue {
  hasBar?: boolean;
  hasBlock?: boolean;
  hasButton?: boolean;
  hasRoot?: boolean;
  isDocumentBroken?: boolean;
}

interface RunResultValue {
  bar: FakeBarValue;
  block: FakeBlockValue;
  clickButton: () => void;
  dispatch: (event: FakeEventValue) => void;
  listenerTypes: string[];
  reloads: { count: number };
  removeBlock: () => void;
  usedCapture: boolean[];
}

const ELEMENT_ID = 'boot-fallback';

const ROOT_ID = 'root';

const script = createBootFallbackScript({ elementId: ELEMENT_ID, rootId: ROOT_ID });

const resource = (tagName: string, rel?: string): FakeEventValue => ({ target: { rel, tagName } });

const runScript = (options: RunOptionsValue = {}): RunResultValue => {
  const {
    hasBar = true,
    hasBlock = true,
    hasButton = true,
    hasRoot = true,
    isDocumentBroken = false,
  } = options;
  const bar: FakeBarValue = { hidden: false };
  const block: FakeBlockValue = { attributes: {}, hidden: true };
  const reloads = { count: 0 };
  const listenerTypes: string[] = [];
  const usedCapture: boolean[] = [];
  const windowListeners: ((event: FakeEventValue) => void)[] = [];
  const buttonListeners: (() => void)[] = [];
  const state = { isBlockPresent: hasBlock };

  const fakeBlock = {
    get hidden(): boolean {
      return block.hidden;
    },
    set hidden(value: boolean) {
      block.hidden = value;
    },
    querySelector: (selector: string): unknown => {
      if (selector !== 'button' || !hasButton) {
        return null;
      }

      return {
        addEventListener: (_type: string, listener: () => void): void => {
          buttonListeners.push(listener);
        },
      };
    },
    setAttribute: (name: string, value: string): void => {
      block.attributes[name] = value;
    },
  };

  const fakeRoot = {
    querySelector: (selector: string): unknown => (selector === '.boot-bar' && hasBar ? bar : null),
  };

  const fakeDocument = {
    getElementById: (id: string): unknown => {
      if (isDocumentBroken) {
        throw new Error('document is broken');
      }

      if (id === ELEMENT_ID) {
        return state.isBlockPresent ? fakeBlock : null;
      }

      return id === ROOT_ID && hasRoot ? fakeRoot : null;
    },
  };

  runInNewContext(script, {
    addEventListener: (type: string, listener: (event: FakeEventValue) => void, capture: boolean): void => {
      listenerTypes.push(type);
      usedCapture.push(capture);
      windowListeners.push(listener);
    },
    document: fakeDocument,
    location: {
      reload: (): void => {
        reloads.count += 1;
      },
    },
  });

  return {
    bar,
    block,
    clickButton: () => {
      for (const listener of buttonListeners) {
        listener();
      }
    },
    dispatch: (event) => {
      for (const listener of windowListeners) {
        listener(event);
      }
    },
    listenerTypes,
    reloads,
    removeBlock: () => {
      state.isBlockPresent = false;
    },
    usedCapture,
  };
};

describe('createBootFallbackScript', () => {
  it('listens to errors on the window in the capture phase', () => {
    const { listenerTypes, usedCapture } = runScript();

    expect(listenerTypes).toEqual(['error']);
    expect(usedCapture).toEqual([true]);
  });

  it('keeps the block hidden until an error arrives', () => {
    const { block } = runScript();

    expect(block.hidden).toBe(true);
    expect(block.attributes.role).toBeUndefined();
  });

  it('shows the block as an alert and hides the boot bar when a script fails to load', () => {
    const { bar, block, dispatch } = runScript();

    dispatch(resource('SCRIPT'));

    expect(block.hidden).toBe(false);
    expect(block.attributes.role).toBe('alert');
    expect(bar.hidden).toBe(true);
  });

  it.each(['stylesheet', 'modulepreload'])('shows the block when a link with rel %s fails to load', (rel) => {
    const { block, dispatch } = runScript();

    dispatch(resource('LINK', rel));

    expect(block.hidden).toBe(false);
    expect(block.attributes.role).toBe('alert');
  });

  it.each(['icon', 'preload', 'manifest', 'apple-touch-icon'])('ignores a link with rel %s', (rel) => {
    const { block, dispatch } = runScript();

    dispatch(resource('LINK', rel));

    expect(block.hidden).toBe(true);
  });

  it.each(['IMG', 'VIDEO', 'AUDIO', 'IFRAME', 'SOURCE'])('ignores a failed %s', (tagName) => {
    const { bar, block, dispatch } = runScript();

    dispatch(resource(tagName));

    expect(block.hidden).toBe(true);
    expect(bar.hidden).toBe(false);
  });

  it.each([
    { name: 'the window', target: {} },
    { name: 'a null target', target: null },
    { name: 'no target', target: undefined },
  ])('shows the block for an error event whose target is $name', ({ target }) => {
    const { block, dispatch } = runScript();

    dispatch({ target });

    expect(block.hidden).toBe(false);
    expect(block.attributes.role).toBe('alert');
  });

  it('does nothing and does not throw when an error arrives before the block exists', () => {
    const { block, dispatch } = runScript({ hasBlock: false });

    expect(() => {
      dispatch(resource('SCRIPT'));
    }).not.toThrow();
    expect(block.hidden).toBe(true);
  });

  it('does nothing and does not throw after the block is removed', () => {
    const { bar, block, dispatch, removeBlock } = runScript();

    removeBlock();

    expect(() => {
      dispatch(resource('SCRIPT'));
    }).not.toThrow();
    expect(block.hidden).toBe(true);
    expect(bar.hidden).toBe(false);
  });

  it('reloads the page when the button is clicked', () => {
    const { clickButton, dispatch, reloads } = runScript();

    dispatch(resource('SCRIPT'));
    clickButton();

    expect(reloads.count).toBe(1);
  });

  it('binds the button once however many errors arrive', () => {
    const { clickButton, dispatch, reloads } = runScript();

    dispatch(resource('SCRIPT'));
    dispatch(resource('LINK', 'stylesheet'));
    dispatch({ target: null });
    clickButton();

    expect(reloads.count).toBe(1);
  });

  it('does not reload before an error is shown', () => {
    const { clickButton, reloads } = runScript();

    clickButton();

    expect(reloads.count).toBe(0);
  });

  it('shows the block without throwing when the document has no root', () => {
    const { block, dispatch } = runScript({ hasRoot: false });

    expect(() => {
      dispatch(resource('SCRIPT'));
    }).not.toThrow();
    expect(block.hidden).toBe(false);
  });

  it('shows the block without throwing when the root has no boot bar', () => {
    const { block, dispatch } = runScript({ hasBar: false });

    expect(() => {
      dispatch(resource('SCRIPT'));
    }).not.toThrow();
    expect(block.hidden).toBe(false);
  });

  it('shows the block without throwing when the block has no button', () => {
    const { block, clickButton, dispatch } = runScript({ hasButton: false });

    expect(() => {
      dispatch(resource('SCRIPT'));
    }).not.toThrow();
    expect(() => {
      clickButton();
    }).not.toThrow();
    expect(block.hidden).toBe(false);
  });

  it('does not let an exception escape when the document is broken', () => {
    const { dispatch } = runScript({ isDocumentBroken: true });

    expect(() => {
      dispatch(resource('SCRIPT'));
    }).not.toThrow();
  });

  it('stays within one kilobyte and keeps closing script tags out of the output', () => {
    expect(Buffer.byteLength(script)).toBeLessThanOrEqual(1024);

    const hostileScript = createBootFallbackScript({ elementId: '</script>', rootId: '</script>' });

    expect(hostileScript).not.toContain('</script');
  });
});
