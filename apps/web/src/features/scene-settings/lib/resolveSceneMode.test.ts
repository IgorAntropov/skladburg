import {
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import type { QualityLevelValue } from '@/shared/3d';
import type { ViewportClassValue } from '@/shared/lib/viewport';

import type { GraphicsPreferenceValue } from '../model/graphicsPreference';
import type { SceneModeValue } from './resolveSceneMode';

import { resolveSceneMode } from './resolveSceneMode';

type ModeCaseBaseValue = Omit<ModeCaseValue, 'expected' | 'title'>;

interface ModeCaseValue {
  autoLevel: QualityLevelValue | undefined;
  expected: SceneModeValue;
  isSoftwareRenderer: boolean;
  isWebGlAvailable: boolean;
  preference: GraphicsPreferenceValue | undefined;
  title: string;
  viewportClass: ViewportClassValue;
}

const BASE_CASE: ModeCaseBaseValue = {
  autoLevel: undefined,
  isSoftwareRenderer: false,
  isWebGlAvailable: true,
  preference: undefined,
  viewportClass: 'desktop',
};

const MODE_CASES: readonly ModeCaseValue[] = [
  {
    ...BASE_CASE,
    expected: { autoCeiling: 'high', isAuto: true, kind: '3d', level: 'high' },
    title: 'desktop default is auto at the high level',
  },
  {
    ...BASE_CASE,
    expected: { autoCeiling: 'medium', isAuto: true, kind: '3d', level: 'medium' },
    title: 'tablet default is auto at the medium level',
    viewportClass: 'tablet',
  },
  {
    ...BASE_CASE,
    expected: { kind: 'off', reason: 'phoneDefault' },
    title: 'phone default is the light mode',
    viewportClass: 'phone',
  },
  {
    ...BASE_CASE,
    expected: { autoCeiling: 'medium', isAuto: true, kind: '3d', level: 'medium' },
    preference: 'auto',
    title: 'phone with auto chosen by hand is auto at the medium level',
    viewportClass: 'phone',
  },
  {
    ...BASE_CASE,
    autoLevel: 'low',
    expected: { autoCeiling: 'high', isAuto: true, kind: '3d', level: 'low' },
    preference: 'auto',
    title: 'auto follows the measured level',
  },
  {
    ...BASE_CASE,
    autoLevel: 'medium',
    expected: { autoCeiling: 'high', isAuto: true, kind: '3d', level: 'medium' },
    title: 'auto at the default preference follows the measured level',
  },
  {
    ...BASE_CASE,
    autoLevel: 'high',
    expected: { autoCeiling: 'medium', isAuto: true, kind: '3d', level: 'medium' },
    title: 'the measured level above the device ceiling is clamped to the ceiling',
    viewportClass: 'tablet',
  },
  {
    ...BASE_CASE,
    autoLevel: 'medium',
    expected: { autoCeiling: 'medium', isAuto: true, kind: '3d', level: 'medium' },
    title: 'the measured level equal to the ceiling stays',
    viewportClass: 'tablet',
  },
  {
    ...BASE_CASE,
    expected: { autoCeiling: 'low', isAuto: true, kind: '3d', level: 'low' },
    isSoftwareRenderer: true,
    title: 'a software renderer starts auto at the low level on a desktop',
  },
  {
    ...BASE_CASE,
    expected: { autoCeiling: 'low', isAuto: true, kind: '3d', level: 'low' },
    isSoftwareRenderer: true,
    title: 'a software renderer starts auto at the low level on a tablet',
    viewportClass: 'tablet',
  },
  {
    ...BASE_CASE,
    autoLevel: 'high',
    expected: { autoCeiling: 'low', isAuto: true, kind: '3d', level: 'low' },
    isSoftwareRenderer: true,
    title: 'the measured level above the software ceiling is clamped to low',
  },
  {
    ...BASE_CASE,
    expected: { autoCeiling: 'low', isAuto: true, kind: '3d', level: 'low' },
    isSoftwareRenderer: true,
    preference: 'auto',
    title: 'a software renderer on a phone with auto chosen by hand is auto at the low level',
    viewportClass: 'phone',
  },
  {
    ...BASE_CASE,
    autoLevel: 'low',
    expected: { isAuto: false, kind: '3d', level: 'high' },
    preference: 'high',
    title: 'a fixed level ignores the measured level',
  },
  {
    ...BASE_CASE,
    expected: { isAuto: false, kind: '3d', level: 'high' },
    isSoftwareRenderer: true,
    preference: 'high',
    title: 'a software renderer does not touch a fixed level chosen by hand',
  },
  {
    ...BASE_CASE,
    expected: { isAuto: false, kind: '3d', level: 'low' },
    preference: 'low',
    title: 'low on a phone is a fixed low level',
    viewportClass: 'phone',
  },
  {
    ...BASE_CASE,
    expected: { isAuto: false, kind: '3d', level: 'medium' },
    preference: 'medium',
    title: 'medium on a tablet is a fixed medium level',
    viewportClass: 'tablet',
  },
  {
    ...BASE_CASE,
    expected: { kind: 'off', reason: 'preference' },
    preference: 'off',
    title: 'off by choice on a desktop',
  },
  {
    ...BASE_CASE,
    expected: { kind: 'off', reason: 'preference' },
    preference: 'off',
    title: 'off by choice on a phone',
    viewportClass: 'phone',
  },
  {
    ...BASE_CASE,
    expected: { kind: 'off', reason: 'noWebGl' },
    isWebGlAvailable: false,
    title: 'no WebGL on a desktop falls back to the light mode',
  },
  {
    ...BASE_CASE,
    expected: { kind: 'off', reason: 'noWebGl' },
    isWebGlAvailable: false,
    preference: 'high',
    title: 'no WebGL beats a fixed level',
    viewportClass: 'tablet',
  },
  {
    ...BASE_CASE,
    expected: { kind: 'off', reason: 'phoneDefault' },
    isWebGlAvailable: false,
    title: 'the phone default is reported before WebGL is considered',
    viewportClass: 'phone',
  },
  {
    ...BASE_CASE,
    expected: { kind: 'off', reason: 'noWebGl' },
    isWebGlAvailable: false,
    preference: 'auto',
    title: 'no WebGL on a phone with auto chosen by hand is reported as no WebGL',
    viewportClass: 'phone',
  },
  {
    ...BASE_CASE,
    expected: { kind: 'off', reason: 'preference' },
    isWebGlAvailable: false,
    preference: 'off',
    title: 'off by choice stays off by choice without WebGL',
  },
];

describe('resolveSceneMode', () => {
  it.each(MODE_CASES)('$title', ({ autoLevel, expected, isSoftwareRenderer, isWebGlAvailable, preference, viewportClass }) => {
    expect(resolveSceneMode({
      autoLevel,
      isSoftwareRenderer: () => isSoftwareRenderer,
      isWebGlAvailable: () => isWebGlAvailable,
      preference,
      viewportClass,
    })).toEqual(expected);
  });

  describe('lazy probes', () => {
    it.each([
      ['off by choice on a desktop', 'off', 'desktop'],
      ['off by choice on a phone', 'off', 'phone'],
      ['the phone default', undefined, 'phone'],
    ] as const)('does not run the probes for %s', (_title, preference, viewportClass) => {
      const isWebGlAvailable = vi.fn(() => false);
      const isSoftwareRenderer = vi.fn(() => false);

      resolveSceneMode({ autoLevel: undefined, isSoftwareRenderer, isWebGlAvailable, preference, viewportClass });

      expect(isWebGlAvailable).not.toHaveBeenCalled();
      expect(isSoftwareRenderer).not.toHaveBeenCalled();
    });

    it('runs the WebGL probe once when the scene could be shown and reports no WebGL without asking about the renderer', () => {
      const isWebGlAvailable = vi.fn(() => false);
      const isSoftwareRenderer = vi.fn(() => false);

      const mode = resolveSceneMode({
        autoLevel: undefined,
        isSoftwareRenderer,
        isWebGlAvailable,
        preference: undefined,
        viewportClass: 'desktop',
      });

      expect(isWebGlAvailable).toHaveBeenCalledOnce();
      expect(isSoftwareRenderer).not.toHaveBeenCalled();
      expect(mode).toEqual({ kind: 'off', reason: 'noWebGl' });
    });

    it('does not ask about the renderer for a fixed level', () => {
      const isSoftwareRenderer = vi.fn(() => true);

      resolveSceneMode({
        autoLevel: undefined,
        isSoftwareRenderer,
        isWebGlAvailable: () => true,
        preference: 'high',
        viewportClass: 'desktop',
      });

      expect(isSoftwareRenderer).not.toHaveBeenCalled();
    });
  });
});
