import {
  act,
  cleanup,
  render,
  screen,
} from '@testing-library/react';
import { useEffect } from 'react';
import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import type { AnnounceFunction } from './LiveRegionContext';

import { LiveRegionProvider } from './LiveRegionProvider';
import { useAnnounce } from './useAnnounce';

const captured: { announce: AnnounceFunction | undefined } = { announce: undefined };

const Capture = (): null => {
  const announce = useAnnounce();

  useEffect(() => {
    captured.announce = announce;
  }, [announce]);

  return null;
};

const getAnnounce = (): AnnounceFunction => {
  const { announce } = captured;
  if (announce === undefined) {
    throw new Error('announce is not captured');
  }

  return announce;
};

describe('LiveRegion', () => {
  afterEach(() => {
    cleanup();
    captured.announce = undefined;
  });

  it('announces the same text again in a fresh node so assistive technology reads it again', () => {
    render(<LiveRegionProvider><Capture /></LiveRegionProvider>);

    act(() => {
      getAnnounce()('Switching');
    });
    const firstNode = screen.getByText('Switching');

    act(() => {
      getAnnounce()('Switching');
    });
    const secondNode = screen.getByText('Switching');

    expect(secondNode).not.toBe(firstNode);
    expect(firstNode.isConnected).toBe(false);
    expect(screen.getByRole('status').textContent).toBe('Switching');
  });

  it('does not render the children again when a message arrives', () => {
    const onRender = vi.fn();
    const Child = (): null => {
      onRender();

      return null;
    };
    render(
      <LiveRegionProvider>
        <Capture />
        <Child />
      </LiveRegionProvider>,
    );
    const rendersBefore = onRender.mock.calls.length;

    act(() => {
      getAnnounce()('One');
    });

    expect(onRender).toHaveBeenCalledTimes(rendersBefore);
  });
});
