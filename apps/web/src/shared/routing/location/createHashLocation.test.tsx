import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { createHashLocation } from './createHashLocation';

const DEAL_PATH = '/deals/00000000-0000-4000-8000-000000000001';

const waitForNotification = (listener: ReturnType<typeof vi.fn>, callsCount: number): Promise<void> => {
  return vi.waitFor(() => {
    expect(listener).toHaveBeenCalledTimes(callsCount);
  });
};

describe('createHashLocation', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('reads an empty hash as the root path', () => {
    const location = createHashLocation(window);

    expect(location.read().path).toBe('/');
    expect(location.read().searchParams.size).toBe(0);
  });

  it('reads the path and parameters from inside the fragment', () => {
    window.history.replaceState(null, '', `/#${DEAL_PATH}?as=seller-1&tab=docs`);
    const location = createHashLocation(window);

    expect(location.read().path).toBe(DEAL_PATH);
    expect(location.read().searchParams.get('as')).toBe('seller-1');
    expect(location.read().searchParams.get('tab')).toBe('docs');
    expect(window.location.search).toBe('');
  });

  it('reads a bare hash sign as the root path', () => {
    window.history.replaceState(null, '', '/#');
    const location = createHashLocation(window);

    expect(location.read().path).toBe('/');
  });

  it('reads parameters without a path as the root path', () => {
    window.history.replaceState(null, '', '/#?as=seller-1');
    const location = createHashLocation(window);

    expect(location.read().path).toBe('/');
    expect(location.read().searchParams.get('as')).toBe('seller-1');
  });

  it('creates a fragment link', () => {
    const location = createHashLocation(window);

    expect(location.createHref(DEAL_PATH)).toBe(`#${DEAL_PATH}`);
  });

  it('returns the same snapshot object until the address changes', () => {
    const location = createHashLocation(window);
    const first = location.read();

    expect(location.read()).toBe(first);

    location.navigate('/network');

    const second = location.read();

    expect(second).not.toBe(first);
    expect(location.read()).toBe(second);
  });

  it('pushes a new history entry and keeps the document path and query', () => {
    window.history.replaceState(null, '', '/skladburg/?debug=1');
    const location = createHashLocation(window);
    const lengthBefore = window.history.length;

    location.navigate('/catalog');

    expect(window.history.length).toBe(lengthBefore + 1);
    expect(window.location.pathname).toBe('/skladburg/');
    expect(window.location.search).toBe('?debug=1');
    expect(window.location.hash).toBe('#/catalog');
    expect(location.read().path).toBe('/catalog');
  });

  it('replaces the current entry on request', () => {
    const location = createHashLocation(window);
    const lengthBefore = window.history.length;

    location.navigate('/catalog', { isReplace: true });

    expect(window.history.length).toBe(lengthBefore);
    expect(window.location.hash).toBe('#/catalog');
  });

  it('replaces instead of pushing when the address does not change', () => {
    const location = createHashLocation(window);

    location.navigate('/catalog');
    const lengthBefore = window.history.length;
    location.navigate('/catalog');

    expect(window.history.length).toBe(lengthBefore);
  });

  it('keeps parameters when navigating to a path with a query', () => {
    const location = createHashLocation(window);

    location.navigate(`${DEAL_PATH}?as=buyer-1`);

    expect(window.location.hash).toBe(`#${DEAL_PATH}?as=buyer-1`);
    expect(location.read().searchParams.get('as')).toBe('buyer-1');
  });

  it('notifies subscribers synchronously after navigate', () => {
    const location = createHashLocation(window);
    const listener = vi.fn();
    location.subscribe(listener);

    location.navigate('/deals');

    expect(listener).toHaveBeenCalledTimes(1);
    expect(location.read().path).toBe('/deals');
  });

  it('notifies once for a replace', () => {
    const location = createHashLocation(window);
    const listener = vi.fn();
    location.subscribe(listener);

    location.navigate('/deals', { isReplace: true });

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('does not notify twice after its own navigate when hashchange arrives', () => {
    const location = createHashLocation(window);
    const listener = vi.fn();
    location.subscribe(listener);

    location.navigate('/deals');
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    window.dispatchEvent(new PopStateEvent('popstate'));

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('follows an external hash change', async () => {
    const location = createHashLocation(window);
    const listener = vi.fn();
    location.subscribe(listener);

    window.location.hash = '#/warehouse';
    await waitForNotification(listener, 1);

    expect(location.read().path).toBe('/warehouse');
  });

  it('notifies once for a hashchange followed by a popstate', () => {
    const location = createHashLocation(window);
    const listener = vi.fn();
    location.subscribe(listener);

    window.history.replaceState(null, '', '/#/warehouse');
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    window.dispatchEvent(new PopStateEvent('popstate'));

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('goes back and forward through its own entries', async () => {
    const location = createHashLocation(window);
    const listener = vi.fn();
    location.navigate('/network');
    location.navigate('/deals');
    location.subscribe(listener);

    window.history.back();
    await waitForNotification(listener, 1);

    expect(location.read().path).toBe('/network');

    window.history.forward();
    await waitForNotification(listener, 2);

    expect(location.read().path).toBe('/deals');
  });

  it('stops notifying after unsubscribe', () => {
    const location = createHashLocation(window);
    const listener = vi.fn();
    const unsubscribe = location.subscribe(listener);

    location.navigate('/deals');
    unsubscribe();
    location.navigate('/catalog');
    window.history.replaceState(null, '', '/#/warehouse');
    window.dispatchEvent(new HashChangeEvent('hashchange'));

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('removes its window listeners after the last unsubscribe', () => {
    const addEventListener = vi.spyOn(window, 'addEventListener');
    const removeEventListener = vi.spyOn(window, 'removeEventListener');
    const location = createHashLocation(window);

    const unsubscribeFirst = location.subscribe(vi.fn());
    const unsubscribeSecond = location.subscribe(vi.fn());
    unsubscribeFirst();

    expect(removeEventListener).not.toHaveBeenCalled();

    unsubscribeSecond();

    expect(addEventListener.mock.calls.map(([type]) => type).sort()).toEqual(['hashchange', 'popstate']);
    expect(removeEventListener.mock.calls.map(([type]) => type).sort()).toEqual(['hashchange', 'popstate']);
  });

  it('keeps the second subscription of the same function after a repeated unsubscribe', () => {
    const location = createHashLocation(window);
    const listener = vi.fn();
    const unsubscribe = location.subscribe(listener);
    location.subscribe(listener);

    unsubscribe();
    unsubscribe();
    location.navigate('/deals');

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('reloads the page through the target', () => {
    const reload = vi.fn();
    const target = { location: { hash: '', reload } } as unknown as Window;
    const location = createHashLocation(target);

    location.reload();

    expect(reload).toHaveBeenCalledTimes(1);
  });
});
