import { render } from '@testing-library/react';
import { createRef } from 'react';
import {
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { mergeRefs } from './mergeRefs';

describe('mergeRefs', () => {
  it('fills the object refs and calls the callback refs', () => {
    const objectRef = createRef<HTMLButtonElement>();
    const callbackRef = vi.fn();

    const { container } = render(<button ref={mergeRefs(objectRef, callbackRef)} type="button" />);
    const button = container.querySelector('button');

    expect(objectRef.current).toBe(button);
    expect(callbackRef).toHaveBeenCalledWith(button);
  });

  it('clears the object refs and cleans up the callback refs on unmount', () => {
    const objectRef = createRef<HTMLButtonElement>();
    const cleanup = vi.fn();
    const callbackRefWithCleanup = vi.fn(() => cleanup);
    const callbackRefWithoutCleanup = vi.fn();

    const { unmount } = render(
      <button ref={mergeRefs(objectRef, callbackRefWithCleanup, callbackRefWithoutCleanup)} type="button" />,
    );
    unmount();

    expect(objectRef.current).toBeNull();
    expect(cleanup).toHaveBeenCalledOnce();
    expect(callbackRefWithoutCleanup).toHaveBeenLastCalledWith(null);
  });

  it('skips the refs that are missing', () => {
    const objectRef = createRef<HTMLButtonElement>();

    const { container } = render(<button ref={mergeRefs(undefined, null, objectRef)} type="button" />);

    expect(objectRef.current).toBe(container.querySelector('button'));
  });
});
