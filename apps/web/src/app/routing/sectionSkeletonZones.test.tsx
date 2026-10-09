import {
  cleanup,
  render,
  screen,
} from '@testing-library/react';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest';

import type { ViewportClassValue } from '@/shared/lib/viewport';
import type { IFakeViewport } from '@/shared/lib/viewport/index.testing';
import type { AppSectionValue } from '@/shared/routing';

import { withTestLocalizer } from '@/shared/i18n/index.testing';
import { installFakeViewport } from '@/shared/lib/viewport/index.testing';
import { APP_SECTIONS } from '@/shared/routing';

import {
  getPathSkeletonZones,
  getSkeletonZones,
  NEUTRAL_SKELETON_ZONES,
  SECTION_SKELETON_ZONES,
} from './sectionSkeletonZones';
import { SessionPendingScreen } from './SessionPendingScreen';

const FRAMES_BY_SECTION: Readonly<Record<AppSectionValue, Readonly<Record<ViewportClassValue, readonly string[]>>>> = {
  catalog: {
    desktop: ['hud-skeleton-panel', 'hud-skeleton-inspector'],
    phone: ['hud-skeleton-panel'],
    tablet: ['hud-skeleton-panel'],
  },
  deals: {
    desktop: ['hud-skeleton-panel', 'hud-skeleton-inspector'],
    phone: ['hud-skeleton-panel'],
    tablet: ['hud-skeleton-panel'],
  },
  network: {
    desktop: ['hud-skeleton-kpi', 'hud-skeleton-tracker', 'hud-skeleton-inspector', 'hud-skeleton-lists'],
    phone: ['hud-skeleton-lists'],
    tablet: ['hud-skeleton-kpi', 'hud-skeleton-lists'],
  },
  warehouse: {
    desktop: ['hud-skeleton-inspector', 'hud-skeleton-lists'],
    phone: ['hud-skeleton-lists'],
    tablet: ['hud-skeleton-lists'],
  },
};

const VIEWPORT_CLASSES = ['desktop', 'tablet', 'phone'] as const;

const drawnFrames = (): readonly string[] => {
  return [...screen.getByTestId('hud-layout-skeleton').querySelectorAll('[data-testid^="hud-skeleton-"]')]
    .map(frame => frame.getAttribute('data-testid') ?? '');
};

describe('section skeleton zones', () => {
  let viewport: IFakeViewport;

  beforeEach(() => {
    viewport = installFakeViewport('desktop');
  });

  afterEach(() => {
    cleanup();
    viewport.restore();
  });

  describe.each(APP_SECTIONS)('the section %s', (section) => {
    it.each(VIEWPORT_CLASSES)('draws exactly its frames on a %s', (viewportClass) => {
      viewport.setViewportClass(viewportClass);
      render(withTestLocalizer(<SessionPendingScreen zones={getSkeletonZones({ kind: 'section', section })} />));

      expect(drawnFrames()).toEqual(FRAMES_BY_SECTION[section][viewportClass]);
    });
  });

  describe('without a section', () => {
    it.each(VIEWPORT_CLASSES)('draws only the scene without frames on a %s', (viewportClass) => {
      viewport.setViewportClass(viewportClass);
      render(withTestLocalizer(<SessionPendingScreen zones={getSkeletonZones(undefined)} />));

      expect(drawnFrames()).toEqual([]);
      expect(screen.getByTestId('hud-layout-skeleton').className).toContain('bg-canvas');
      expect(screen.getByRole('main', { busy: true })).toBeDefined();
      expect(screen.getByRole('status')).toBeDefined();
    });
  });

  describe('the table', () => {
    it('keeps a row for every section', () => {
      expect(Object.keys(SECTION_SKELETON_ZONES).sort()).toEqual([...APP_SECTIONS].sort());
    });

    it('lists the zones the pages of the sections pass to the layout', () => {
      expect(SECTION_SKELETON_ZONES.network).toEqual({
        hasInspector: true,
        hasKpi: true,
        hasPanel: false,
        hasTracker: true,
        lists: { hasHeader: false },
      });
      expect(SECTION_SKELETON_ZONES.warehouse).toEqual({
        hasInspector: true,
        hasKpi: false,
        hasPanel: false,
        hasTracker: false,
        lists: { hasHeader: true },
      });
      expect(SECTION_SKELETON_ZONES.catalog).toEqual({
        hasInspector: true,
        hasKpi: false,
        hasPanel: true,
        hasTracker: false,
        lists: undefined,
      });
      expect(SECTION_SKELETON_ZONES.deals).toEqual(SECTION_SKELETON_ZONES.catalog);
    });

    it('has no zones in the neutral set', () => {
      expect(NEUTRAL_SKELETON_ZONES).toEqual({
        hasInspector: false,
        hasKpi: false,
        hasPanel: false,
        hasTracker: false,
        lists: undefined,
      });
    });
  });

  describe('the address', () => {
    it('takes the section of an object by its home section', () => {
      expect(getSkeletonZones({ kind: 'object', object: { id: 'order-1', type: 'deal' } })).toBe(SECTION_SKELETON_ZONES.deals);
      expect(getSkeletonZones({ kind: 'object', object: { id: 'cell-1', type: 'cell' } })).toBe(SECTION_SKELETON_ZONES.warehouse);
    });

    it('is neutral for the root, for an unknown address and for no address', () => {
      expect(getSkeletonZones({ kind: 'home' })).toBe(NEUTRAL_SKELETON_ZONES);
      expect(getSkeletonZones(undefined)).toBe(NEUTRAL_SKELETON_ZONES);
    });

    it('takes the section from a path', () => {
      expect(getPathSkeletonZones('/network')).toBe(SECTION_SKELETON_ZONES.network);
      expect(getPathSkeletonZones('/warehouse/')).toBe(SECTION_SKELETON_ZONES.warehouse);
      expect(getPathSkeletonZones('/deals/order-1')).toBe(SECTION_SKELETON_ZONES.deals);
      expect(getPathSkeletonZones('/')).toBe(NEUTRAL_SKELETON_ZONES);
      expect(getPathSkeletonZones('/nope')).toBe(NEUTRAL_SKELETON_ZONES);
      expect(getPathSkeletonZones('/network/unknown/x')).toBe(NEUTRAL_SKELETON_ZONES);
    });
  });
});
