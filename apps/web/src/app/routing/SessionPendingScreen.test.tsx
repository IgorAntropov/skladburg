import {
  act,
  cleanup,
  render,
  screen,
} from '@testing-library/react';
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

import { SECTION_SKELETON_ZONES } from './sectionSkeletonZones';
import { SessionPendingScreen } from './SessionPendingScreen';

const catalog = defaultLocaleCatalog;

const isHidden = (element: HTMLElement): boolean => element.className.split(/\s+/).includes('invisible');

describe('SessionPendingScreen', () => {
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

  it('is a busy landmark with the quiet status as the only text', () => {
    render(withTestLocalizer(<SessionPendingScreen zones={SECTION_SKELETON_ZONES.network} />));

    const landmark = screen.getByRole('main', { busy: true });

    expect(landmark.textContent).toBe(catalog['session.loading']);
    expect(landmark.querySelector('.sr-only')?.textContent).toBe(catalog['session.loading']);
  });

  it('draws the skeleton of the layout named by the same status', () => {
    render(withTestLocalizer(<SessionPendingScreen zones={SECTION_SKELETON_ZONES.network} />));

    expect(screen.getByRole('status', { name: catalog['session.loading'] })).toBeDefined();
    expect(screen.getByTestId('hud-layout-skeleton')).toBeDefined();
  });

  it('fills the page below the top bar as a column', () => {
    render(withTestLocalizer(<SessionPendingScreen zones={SECTION_SKELETON_ZONES.network} />));

    const classNames = screen.getByRole('main').className.split(/\s+/);

    expect(classNames).toEqual(expect.arrayContaining(['flex', 'flex-1', 'flex-col']));
  });

  it('shows nothing of the skeleton until the threshold and then shows it', () => {
    render(withTestLocalizer(<SessionPendingScreen zones={SECTION_SKELETON_ZONES.network} />));

    expect(isHidden(screen.getByTestId('hud-layout-skeleton'))).toBe(true);

    act(() => {
      vi.advanceTimersByTime(SKELETON_DELAY_MS - 1);
    });

    expect(isHidden(screen.getByTestId('hud-layout-skeleton'))).toBe(true);

    act(() => {
      vi.advanceTimersByTime(1);
    });

    expect(isHidden(screen.getByTestId('hud-layout-skeleton'))).toBe(false);
  });

  it.each(['desktop', 'tablet', 'phone'] as const)('draws the zones of a %s', (viewportClass) => {
    viewport.setViewportClass(viewportClass);
    render(withTestLocalizer(<SessionPendingScreen zones={SECTION_SKELETON_ZONES.network} />));

    expect(screen.getByTestId('hud-skeleton-lists')).toBeDefined();
    expect(screen.queryByTestId('hud-skeleton-kpi') !== null).toBe(viewportClass !== 'phone');
  });
});
