import type {
  ComponentType,
  ReactElement,
} from 'react';

import {
  act,
  cleanup,
  render,
  screen,
} from '@testing-library/react';
import { lazy } from 'react';
import { defaultLocaleCatalog } from 'virtual:build-profile';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import type { IFakeViewport } from '@/shared/lib/viewport/index.testing';

import { withTestLocalizer } from '@/shared/i18n/index.testing';
import { installFakeViewport } from '@/shared/lib/viewport/index.testing';
import { SKELETON_DELAY_MS } from '@/shared/ui';

import { RouteFrame } from './RouteFrame';

const catalog = defaultLocaleCatalog;

const PAGE_TEST_ID = 'page';

const StubPage = (): ReactElement => <p data-testid={PAGE_TEST_ID} />;

interface PendingPageValue {
  Page: ComponentType;
  resolve: () => void;
}

const createPendingPage = (): PendingPageValue => {
  let resolve: () => void = () => undefined;
  const loaded = new Promise<{ default: ComponentType }>((resolvePromise) => {
    resolve = () => {
      resolvePromise({ default: StubPage });
    };
  });

  return { Page: lazy(() => loaded), resolve };
};

const renderFrame = (Page: ComponentType, path = '/network'): void => {
  render(
    withTestLocalizer(
      <RouteFrame errorResetKey="network" path={path}>
        <Page />
      </RouteFrame>,
    ),
  );
};

const drawnFrames = (): readonly string[] => {
  return [...screen.getByTestId('hud-layout-skeleton').querySelectorAll('[data-testid^="hud-skeleton-"]')]
    .map(frame => frame.getAttribute('data-testid') ?? '');
};

const isHidden = (element: HTMLElement): boolean => element.className.split(/\s+/).includes('invisible');

describe('RouteFrame fallback', () => {
  let viewport: IFakeViewport;

  beforeEach(() => {
    vi.useFakeTimers();
    viewport = installFakeViewport('desktop');
  });

  afterEach(() => {
    cleanup();
    viewport.restore();
    vi.useRealTimers();
  });

  it('draws the skeleton of the layout named by the section status while the chunk is loading', () => {
    const { Page } = createPendingPage();
    renderFrame(Page);

    expect(screen.getByRole('status', { name: catalog['routing.section.loading'] })).toBeDefined();
    expect(screen.getByTestId('hud-layout-skeleton')).toBeDefined();
    expect(screen.queryByTestId(PAGE_TEST_ID)).toBeNull();
  });

  it('keeps the busy landmark without text while the chunk is loading', () => {
    const { Page } = createPendingPage();
    renderFrame(Page);

    const landmark = screen.getByRole('main', { busy: true });

    expect(landmark.textContent).toBe('');
  });

  it('shows nothing of the skeleton until the threshold and then shows it', () => {
    const { Page } = createPendingPage();
    renderFrame(Page);

    expect(isHidden(screen.getByTestId('hud-layout-skeleton'))).toBe(true);

    act(() => {
      vi.advanceTimersByTime(SKELETON_DELAY_MS);
    });

    expect(isHidden(screen.getByTestId('hud-layout-skeleton'))).toBe(false);
  });

  it('replaces the skeleton with the page and drops the busy mark when the chunk is loaded', async () => {
    const { Page, resolve } = createPendingPage();
    renderFrame(Page);

    await act(async () => {
      resolve();
      await Promise.resolve();
    });

    expect(screen.getByTestId(PAGE_TEST_ID)).toBeDefined();
    expect(screen.queryByTestId('hud-layout-skeleton')).toBeNull();
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.getByRole('main').getAttribute('aria-busy')).toBeNull();
  });

  it('never shows the skeleton when the chunk is loaded before the threshold', async () => {
    const { Page, resolve } = createPendingPage();
    renderFrame(Page);

    act(() => {
      vi.advanceTimersByTime(SKELETON_DELAY_MS - 50);
    });

    expect(isHidden(screen.getByTestId('hud-layout-skeleton'))).toBe(true);

    await act(async () => {
      resolve();
      await Promise.resolve();
    });

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(screen.queryByTestId('hud-layout-skeleton')).toBeNull();
    expect(screen.getByTestId(PAGE_TEST_ID)).toBeDefined();
  });

  it('draws no skeleton for a page that is already loaded', () => {
    renderFrame(StubPage);

    expect(screen.getByTestId(PAGE_TEST_ID)).toBeDefined();
    expect(screen.queryByTestId('hud-layout-skeleton')).toBeNull();
  });

  it.each([
    ['/network', ['hud-skeleton-kpi', 'hud-skeleton-tracker', 'hud-skeleton-inspector', 'hud-skeleton-lists']],
    ['/warehouse', ['hud-skeleton-inspector', 'hud-skeleton-lists']],
    ['/catalog', ['hud-skeleton-panel', 'hud-skeleton-inspector']],
    ['/deals', ['hud-skeleton-panel', 'hud-skeleton-inspector']],
    ['/deals/order-1', ['hud-skeleton-panel', 'hud-skeleton-inspector']],
    ['/trips/trip-1', ['hud-skeleton-kpi', 'hud-skeleton-tracker', 'hud-skeleton-inspector', 'hud-skeleton-lists']],
    ['/', []],
    ['/nope', []],
  ] as const)('draws the frames of the section named by the path %s', (path, frames) => {
    const { Page } = createPendingPage();
    renderFrame(Page, path);

    expect(drawnFrames()).toEqual(frames);
  });
});
