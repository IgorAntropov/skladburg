import {
  cleanup,
  renderHook,
} from '@testing-library/react';
import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import type { IFakeViewport } from './index.testing';

import { installFakeViewport } from './index.testing';
import { useViewportClass } from './useViewportClass';
import { VIEWPORT_MEDIA_QUERIES } from './viewportTypes';

describe('useViewportClass', () => {
  let fakeViewport: IFakeViewport | undefined;

  afterEach(() => {
    cleanup();
    fakeViewport?.restore();
    fakeViewport = undefined;
  });

  it('does not ask for the media queries again on repeated renders', () => {
    fakeViewport = installFakeViewport('tablet');
    const matchMediaSpy = vi.spyOn(window, 'matchMedia');
    const { rerender, unmount } = renderHook(() => useViewportClass());
    const callsAfterMount = matchMediaSpy.mock.calls.length;

    rerender();
    rerender();
    rerender();
    unmount();
    renderHook(() => useViewportClass());

    expect(callsAfterMount).toBeLessThanOrEqual(2);
    expect(matchMediaSpy).toHaveBeenCalledTimes(callsAfterMount);
  });

  it('reads the class from the new media query source after the fake is replaced', () => {
    fakeViewport = installFakeViewport('phone');
    const first = renderHook(() => useViewportClass());

    expect(first.result.current).toBe('phone');

    first.unmount();
    fakeViewport.restore();
    fakeViewport = installFakeViewport('tablet');

    expect(renderHook(() => useViewportClass()).result.current).toBe('tablet');

    fakeViewport.restore();
    fakeViewport = undefined;

    expect(renderHook(() => useViewportClass()).result.current).toBe('desktop');
  });

  it('listens to both breakpoints and stops listening after the unmount', () => {
    fakeViewport = installFakeViewport('desktop');
    const queryLists = [
      window.matchMedia(VIEWPORT_MEDIA_QUERIES.desktop),
      window.matchMedia(VIEWPORT_MEDIA_QUERIES.tablet),
    ];
    const addSpies = queryLists.map(queryList => vi.spyOn(queryList, 'addEventListener'));
    const removeSpies = queryLists.map(queryList => vi.spyOn(queryList, 'removeEventListener'));
    const { unmount } = renderHook(() => useViewportClass());

    addSpies.forEach((spy) => {
      expect(spy).toHaveBeenCalledExactlyOnceWith('change', expect.any(Function));
    });
    removeSpies.forEach((spy) => {
      expect(spy).not.toHaveBeenCalled();
    });

    unmount();

    removeSpies.forEach((spy, index) => {
      expect(spy).toHaveBeenCalledExactlyOnceWith('change', addSpies[index]?.mock.calls[0]?.[1]);
    });
  });
});
