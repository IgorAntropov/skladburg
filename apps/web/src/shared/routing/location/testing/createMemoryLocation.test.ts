import {
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { createMemoryLocation } from './createMemoryLocation';

describe('createMemoryLocation', () => {
  it('reads the initial path and parameters', () => {
    const location = createMemoryLocation('/deals/abc?as=customer-1');

    expect(location.read().path).toBe('/deals/abc');
    expect(location.read().searchParams.get('as')).toBe('customer-1');
    expect(location.history).toEqual(['/deals/abc?as=customer-1']);
  });

  it('reads an empty initial path as the root', () => {
    expect(createMemoryLocation('').read().path).toBe('/');
  });

  it('returns a stable snapshot until the address changes', () => {
    const location = createMemoryLocation('/');
    const first = location.read();

    expect(location.read()).toBe(first);

    location.navigate('/network');

    expect(location.read()).not.toBe(first);
  });

  it('pushes entries and notifies subscribers', () => {
    const location = createMemoryLocation('/');
    const listener = vi.fn();
    location.subscribe(listener);

    location.navigate('/network');
    location.navigate('/deals');

    expect(location.history).toEqual(['/', '/network', '/deals']);
    expect(location.currentIndex).toBe(2);
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('replaces the current entry', () => {
    const location = createMemoryLocation('/');

    location.navigate('/network', { isReplace: true });

    expect(location.history).toEqual(['/network']);
    expect(location.currentIndex).toBe(0);
  });

  it('goes back and forward with notifications', () => {
    const location = createMemoryLocation('/network');
    const listener = vi.fn();
    location.navigate('/deals');
    location.subscribe(listener);

    location.back();

    expect(location.read().path).toBe('/network');
    expect(listener).toHaveBeenCalledTimes(1);

    location.forward();

    expect(location.read().path).toBe('/deals');
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('ignores back and forward at the ends', () => {
    const location = createMemoryLocation('/network');
    const listener = vi.fn();
    location.subscribe(listener);

    location.back();
    location.forward();

    expect(listener).not.toHaveBeenCalled();
    expect(location.read().path).toBe('/network');
  });

  it('drops forward entries on push and keeps them on replace', () => {
    const location = createMemoryLocation('/network');
    location.navigate('/deals');
    location.navigate('/catalog');
    location.back();
    location.back();

    location.navigate('/warehouse', { isReplace: true });

    expect(location.history).toEqual(['/warehouse', '/deals', '/catalog']);

    location.navigate('/network');

    expect(location.history).toEqual(['/warehouse', '/network']);
  });

  it('stops notifying after unsubscribe', () => {
    const location = createMemoryLocation('/');
    const listener = vi.fn();
    const unsubscribe = location.subscribe(listener);

    unsubscribe();
    location.navigate('/network');

    expect(listener).not.toHaveBeenCalled();
  });

  it('counts reloads and creates fragment links', () => {
    const location = createMemoryLocation('/');

    location.reload();
    location.reload();

    expect(location.reloadCount).toBe(2);
    expect(location.createHref('/deals')).toBe('#/deals');
  });
});
