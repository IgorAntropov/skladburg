import {
  act,
  cleanup,
  render,
  screen,
  within,
} from '@testing-library/react';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import type { ViewportClassValue } from '@/shared/lib/viewport';
import type { IFakeViewport } from '@/shared/lib/viewport/index.testing';

import { installFakeViewport } from '@/shared/lib/viewport/index.testing';
import {
  SKELETON_DELAY_MS,
  SKELETON_MIN_VISIBLE_MS,
} from '@/shared/ui';

import type { HudSkeletonZonesValue } from '../lib/hudSkeletonZones';

import { HudLayoutSkeleton } from './HudLayoutSkeleton';

const LABEL = 'Opening';

const NO_ZONES: HudSkeletonZonesValue = {
  hasInspector: false,
  hasKpi: false,
  hasPanel: false,
  hasTracker: false,
  lists: undefined,
};

const NETWORK_ZONES: HudSkeletonZonesValue = {
  hasInspector: true,
  hasKpi: true,
  hasPanel: false,
  hasTracker: true,
  lists: { hasHeader: false },
};

const WAREHOUSE_ZONES: HudSkeletonZonesValue = {
  ...NO_ZONES,
  hasInspector: true,
  lists: { hasHeader: true },
};

const PANEL_ZONES: HudSkeletonZonesValue = {
  ...NO_ZONES,
  hasInspector: true,
  hasPanel: true,
};

const ZONE_TEST_IDS_BY_CLASS: Readonly<Record<ViewportClassValue, readonly string[]>> = {
  desktop: ['hud-skeleton-kpi', 'hud-skeleton-tracker', 'hud-skeleton-inspector', 'hud-skeleton-lists'],
  phone: ['hud-skeleton-lists'],
  tablet: ['hud-skeleton-kpi', 'hud-skeleton-lists'],
};

const ALL_ZONE_TEST_IDS = [
  'hud-skeleton-kpi',
  'hud-skeleton-tracker',
  'hud-skeleton-inspector',
  'hud-skeleton-panel',
  'hud-skeleton-lists',
] as const;

const drawnFrames = (): readonly string[] => {
  return [...getLayer().querySelectorAll('[data-testid^="hud-skeleton-"]')].map(frame => frame.getAttribute('data-testid') ?? '');
};

const advance = (milliseconds: number): void => {
  act(() => {
    vi.advanceTimersByTime(milliseconds);
  });
};

const getLayer = (): HTMLElement => screen.getByTestId('hud-layout-skeleton');

const isLayerHidden = (): boolean => getLayer().className.split(/\s+/).includes('invisible');

const countFilledShapes = (): number => {
  return [...getLayer().querySelectorAll('[aria-hidden="true"]')].filter(shape => shape.className.includes('bg-skeleton')).length;
};

describe('HudLayoutSkeleton', () => {
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

  it('exposes the thresholds the skeleton waits for', () => {
    expect(SKELETON_DELAY_MS).toBe(250);
    expect(SKELETON_MIN_VISIBLE_MS).toBe(400);
  });

  it('is one busy status region named by its label', () => {
    render(<HudLayoutSkeleton label={LABEL} zones={NETWORK_ZONES} />);

    const groups = screen.getAllByRole('status');

    expect(groups).toHaveLength(1);
    expect(groups[0]).toBe(screen.getByRole('status', { name: LABEL }));
    expect(groups[0]?.getAttribute('aria-busy')).toBe('true');
  });

  it('hides the whole picture from assistive technology and has no text', () => {
    render(<HudLayoutSkeleton label={LABEL} zones={NETWORK_ZONES} />);

    expect(getLayer().getAttribute('aria-hidden')).toBe('true');
    expect(screen.getByRole('status').textContent).toBe('');
  });

  describe('before the threshold', () => {
    it('shows nothing at the start, neither the fill nor the frames of the zones', () => {
      render(<HudLayoutSkeleton label={LABEL} zones={NETWORK_ZONES} />);

      expect(isLayerHidden()).toBe(true);
      expect(countFilledShapes()).toBe(0);
    });

    it('still shows nothing a moment before the threshold', () => {
      render(<HudLayoutSkeleton label={LABEL} zones={NETWORK_ZONES} />);

      advance(SKELETON_DELAY_MS - 1);

      expect(isLayerHidden()).toBe(true);
      expect(countFilledShapes()).toBe(0);
    });

    it('is never seen when the answer comes before the threshold', () => {
      const { unmount } = render(<HudLayoutSkeleton label={LABEL} zones={NETWORK_ZONES} />);

      advance(200);

      expect(isLayerHidden()).toBe(true);

      unmount();
      advance(2000);

      expect(screen.queryByTestId('hud-layout-skeleton')).toBeNull();
      expect(screen.queryByRole('status')).toBeNull();
    });

    it('keeps the geometry of the zones in place while it is hidden', () => {
      render(<HudLayoutSkeleton label={LABEL} zones={NETWORK_ZONES} />);

      for (const testId of ZONE_TEST_IDS_BY_CLASS.desktop) {
        expect(within(getLayer()).getByTestId(testId)).toBeDefined();
      }
    });
  });

  describe('after the threshold', () => {
    it('appears when the delay is over', () => {
      render(<HudLayoutSkeleton label={LABEL} zones={NETWORK_ZONES} />);

      advance(SKELETON_DELAY_MS);

      expect(isLayerHidden()).toBe(false);
      expect(countFilledShapes()).toBeGreaterThan(0);
    });

    it('stays on the screen for as long as the page is not ready', () => {
      render(<HudLayoutSkeleton label={LABEL} zones={NETWORK_ZONES} />);

      advance(SKELETON_DELAY_MS);
      advance(SKELETON_MIN_VISIBLE_MS);
      advance(5000);

      expect(isLayerHidden()).toBe(false);
      expect(countFilledShapes()).toBeGreaterThan(0);
    });
  });

  describe('the scene behind the zones', () => {
    it('is the plain canvas without a grid', () => {
      render(<HudLayoutSkeleton label={LABEL} zones={NETWORK_ZONES} />);

      expect(getLayer().className).toContain('bg-canvas');
      expect(getLayer().innerHTML).not.toContain('repeating-linear-gradient');
      expect(getLayer().innerHTML).not.toContain('mask-image');
    });
  });

  describe('the geometry of the zones', () => {
    it.each(['desktop', 'tablet', 'phone'] as const)('draws the zones of a %s', (viewportClass) => {
      viewport.setViewportClass(viewportClass);
      render(<HudLayoutSkeleton label={LABEL} zones={NETWORK_ZONES} />);

      const drawn = ALL_ZONE_TEST_IDS.filter(testId => screen.queryByTestId(testId) !== null);

      expect(drawn).toEqual(ALL_ZONE_TEST_IDS.filter(testId => ZONE_TEST_IDS_BY_CLASS[viewportClass].includes(testId)));
    });

    it('puts the kpi and the tracker into the left column and the inspector and the lists into the right one on a desktop', () => {
      render(<HudLayoutSkeleton label={LABEL} zones={NETWORK_ZONES} />);

      const left = screen.getByTestId('hud-skeleton-kpi').parentElement;
      const right = screen.getByTestId('hud-skeleton-inspector').parentElement;

      expect(screen.getByTestId('hud-skeleton-tracker').parentElement).toBe(left);
      expect(screen.getByTestId('hud-skeleton-lists').parentElement).toBe(right);
      expect(left).not.toBe(right);
      expect(right?.className).toContain('ml-auto');
    });

    it('sticks the lists to the bottom on a tablet', () => {
      viewport.setViewportClass('tablet');
      render(<HudLayoutSkeleton label={LABEL} zones={NETWORK_ZONES} />);

      expect(screen.getByTestId('hud-skeleton-lists').className).toContain('sticky bottom-0');
    });

    it('draws one zone on a phone', () => {
      viewport.setViewportClass('phone');
      render(<HudLayoutSkeleton label={LABEL} zones={NETWORK_ZONES} />);

      expect(getLayer().querySelectorAll('[data-testid^="hud-skeleton-"]')).toHaveLength(1);
    });

    it('lets the pointer through the frames', () => {
      render(<HudLayoutSkeleton label={LABEL} zones={NETWORK_ZONES} />);

      for (const testId of ZONE_TEST_IDS_BY_CLASS.desktop) {
        expect(screen.getByTestId(testId).className).toContain('pointer-events-none');
      }
    });

    it('switches the zones when the viewport class changes without losing the visibility', () => {
      render(<HudLayoutSkeleton label={LABEL} zones={NETWORK_ZONES} />);
      advance(SKELETON_DELAY_MS);

      act(() => {
        viewport.setViewportClass('phone');
      });

      expect(screen.queryByTestId('hud-skeleton-kpi')).toBeNull();
      expect(screen.getByTestId('hud-skeleton-lists')).toBeDefined();
      expect(isLayerHidden()).toBe(false);
    });
  });

  describe('the zones of the page', () => {
    const renderZones = (zones: HudSkeletonZonesValue): void => {
      render(<HudLayoutSkeleton label={LABEL} zones={zones} />);
    };

    it('draws only the scene without any frame for no zones on every layout', () => {
      for (const viewportClass of ['desktop', 'tablet', 'phone'] as const) {
        viewport.setViewportClass(viewportClass);
        renderZones(NO_ZONES);

        expect(drawnFrames()).toEqual([]);
        expect(getLayer().className).toContain('bg-canvas');
        expect(screen.getByRole('status', { name: LABEL }).getAttribute('aria-busy')).toBe('true');

        cleanup();
      }
    });

    it('draws the lists with a header as one frame with the header above the tabs on a desktop', () => {
      renderZones(WAREHOUSE_ZONES);

      expect(drawnFrames()).toEqual(['hud-skeleton-inspector', 'hud-skeleton-lists']);

      const lists = screen.getByTestId('hud-skeleton-lists');
      const header = lists.querySelector('.rounded-panel.border');
      const strip = lists.querySelector('.border-b');

      expect(header).not.toBeNull();
      expect(strip).not.toBeNull();
      expect((header as Node).compareDocumentPosition(strip as Node) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it('draws no header in the lists without one', () => {
      renderZones(NETWORK_ZONES);

      expect(screen.getByTestId('hud-skeleton-lists').querySelector('.rounded-panel.border')).toBeNull();
    });

    it('draws the panel in the center column between the side columns on a desktop', () => {
      renderZones({ ...PANEL_ZONES, hasKpi: true });

      const panel = screen.getByTestId('hud-skeleton-panel');
      const column = panel.parentElement;

      expect(drawnFrames()).toEqual(['hud-skeleton-kpi', 'hud-skeleton-panel', 'hud-skeleton-inspector']);
      expect(column?.className).toContain('justify-center');
      expect(panel.className).toContain('max-w-4xl');
    });

    it('draws a second hidden line of the panel description that shows only in a narrow zone', () => {
      renderZones(PANEL_ZONES);

      const blocks = [...screen.getByTestId('hud-skeleton-panel').querySelectorAll('div')];
      const lines = blocks.filter(block => block.className.includes('@max-[27rem]:h-4'));

      expect(lines).toHaveLength(2);
      expect(lines[0]?.className).toContain('h-6');
      expect(lines[0]?.className).toContain('@max-[27rem]:h-4');
      expect(lines[1]?.className).toContain('hidden');
      expect(lines[1]?.className).toContain('@max-[27rem]:block');
      expect(lines[1]?.className).toContain('@max-[27rem]:h-4');
    });

    it('draws a right column with the inspector only for a page without lists on a desktop', () => {
      renderZones(PANEL_ZONES);

      expect(drawnFrames()).toEqual(['hud-skeleton-panel', 'hud-skeleton-inspector']);
      expect(screen.getByTestId('hud-skeleton-inspector').parentElement?.className).toContain('ml-auto');
    });

    it.each([
      ['the tracker with the lists', NETWORK_ZONES, ['hud-skeleton-kpi', 'hud-skeleton-lists']],
      ['the lists alone', WAREHOUSE_ZONES, ['hud-skeleton-lists']],
      ['the panel', PANEL_ZONES, ['hud-skeleton-panel']],
      ['the tracker alone', { ...NO_ZONES, hasTracker: true }, ['hud-skeleton-tracker']],
    ] as const)('draws one bottom zone for %s on a tablet', (_name, zones, expected) => {
      viewport.setViewportClass('tablet');
      renderZones(zones);

      expect(drawnFrames()).toEqual(expected);

      const bottom = [...getLayer().querySelectorAll('.sticky')];

      expect(bottom.length).toBeLessThanOrEqual(1);
    });

    it('flushes the bottom tabs of the tracker with the lists to the edge and pads the lists alone', () => {
      viewport.setViewportClass('tablet');
      renderZones(NETWORK_ZONES);

      expect(screen.getByTestId('hud-skeleton-lists').className).toContain('px-0');

      cleanup();
      renderZones(WAREHOUSE_ZONES);

      expect(screen.getByTestId('hud-skeleton-lists').className).toContain('px-4');
    });

    it('draws the lists and not the panel as the main zone of a phone when both are given', () => {
      viewport.setViewportClass('phone');
      renderZones({ ...PANEL_ZONES, lists: { hasHeader: false } });

      expect(drawnFrames()).toEqual(['hud-skeleton-lists']);
    });

    it('draws the panel as the main zone of a phone without lists', () => {
      viewport.setViewportClass('phone');
      renderZones(PANEL_ZONES);

      expect(drawnFrames()).toEqual(['hud-skeleton-panel']);
    });

    it('draws no frame on a phone for a page with the inspector only', () => {
      viewport.setViewportClass('phone');
      renderZones({ ...NO_ZONES, hasInspector: true });

      expect(drawnFrames()).toEqual([]);
    });
  });
});
