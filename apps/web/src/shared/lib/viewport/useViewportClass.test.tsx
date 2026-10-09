import type { ReactElement } from 'react';

import {
  act,
  cleanup,
  render,
  renderHook,
  screen,
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

const ClassProbe = (): ReactElement => {
  const viewportClass = useViewportClass();

  return <p data-testid="viewport-class">{viewportClass}</p>;
};

describe('useViewportClass', () => {
  let fakeViewport: IFakeViewport | undefined;

  afterEach(() => {
    cleanup();
    fakeViewport?.restore();
    fakeViewport = undefined;
  });

  it.each(['desktop', 'tablet', 'phone'] as const)('returns the %s class of the current viewport', (viewportClass) => {
    fakeViewport = installFakeViewport(viewportClass);

    const { result } = renderHook(() => useViewportClass());

    expect(result.current).toBe(viewportClass);
  });

  it('is a desktop without media queries in the environment', () => {
    const { result } = renderHook(() => useViewportClass());

    expect(result.current).toBe('desktop');
  });

  it('redraws the component when the viewport class changes on the fly', () => {
    fakeViewport = installFakeViewport('desktop');
    render(<ClassProbe />);

    act(() => {
      fakeViewport?.setViewportClass('tablet');
    });

    expect(screen.getByTestId('viewport-class').textContent).toBe('tablet');

    act(() => {
      fakeViewport?.setViewportClass('phone');
    });

    expect(screen.getByTestId('viewport-class').textContent).toBe('phone');

    act(() => {
      fakeViewport?.setViewportClass('desktop');
    });

    expect(screen.getByTestId('viewport-class').textContent).toBe('desktop');
  });

  it('does not redraw while the class stays the same', () => {
    fakeViewport = installFakeViewport('phone');
    const renderCount = vi.fn();
    renderHook(() => {
      renderCount();

      return useViewportClass();
    });
    const rendersAtStart = renderCount.mock.calls.length;

    act(() => {
      fakeViewport?.setViewportClass('phone');
    });

    expect(renderCount).toHaveBeenCalledTimes(rendersAtStart);
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
