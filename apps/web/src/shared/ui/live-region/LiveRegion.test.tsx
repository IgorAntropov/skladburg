import type { ReactElement } from 'react';

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

  it('renders one polite status region that starts empty', () => {
    render(<LiveRegionProvider><Capture /></LiveRegionProvider>);
    const region = screen.getByRole('status');

    expect(screen.getAllByRole('status')).toHaveLength(1);
    expect(region.getAttribute('aria-live')).toBe('polite');
    expect(region.className).toContain('sr-only');
    expect(region.textContent).toBe('');
  });

  it('puts the announced message into the status region', () => {
    render(<LiveRegionProvider><Capture /></LiveRegionProvider>);

    act(() => {
      getAnnounce()('Switching');
    });

    expect(screen.getByRole('status').textContent).toBe('Switching');
  });

  it('replaces the previous message with the next one', () => {
    render(<LiveRegionProvider><Capture /></LiveRegionProvider>);

    act(() => {
      getAnnounce()('Switching');
    });
    act(() => {
      getAnnounce()('Signed in as Anna');
    });

    expect(screen.getByRole('status').textContent).toBe('Signed in as Anna');
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

  it('keeps the announce function stable between renders and announcements', () => {
    const seen: AnnounceFunction[] = [];
    const Collector = (): null => {
      seen.push(useAnnounce());

      return null;
    };
    const { rerender } = render(
      <LiveRegionProvider>
        <Capture />
        <Collector />
      </LiveRegionProvider>,
    );

    act(() => {
      getAnnounce()('One');
    });
    rerender(
      <LiveRegionProvider>
        <Capture />
        <Collector />
      </LiveRegionProvider>,
    );

    expect(seen.length).toBeGreaterThan(1);
    expect(new Set(seen).size).toBe(1);
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

  it('keeps announcing after the announcing component is unmounted', () => {
    const Wrapper = ({ isShown }: { isShown: boolean }): ReactElement => (
      <LiveRegionProvider>{isShown && <Capture />}</LiveRegionProvider>
    );
    const { rerender } = render(<Wrapper isShown />);
    const announce = getAnnounce();

    rerender(<Wrapper isShown={false} />);
    act(() => {
      announce('After unmount');
    });

    expect(screen.getByRole('status').textContent).toBe('After unmount');
  });

  it('does nothing and does not throw without a provider', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    render(<Capture />);

    expect(() => {
      getAnnounce()('Lost');
    }).not.toThrow();
    expect(screen.queryByRole('status')).toBeNull();
    expect(log).toHaveBeenCalledWith('> LiveRegionContext -> announceWithoutProvider:', { message: 'Lost' });

    log.mockRestore();
  });
});
