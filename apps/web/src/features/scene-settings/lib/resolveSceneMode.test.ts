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

interface ModeCaseValue {
  autoLevel?: QualityLevelValue;
  expected: SceneModeValue;
  isWebGlAvailable: boolean;
  preference: GraphicsPreferenceValue | undefined;
  title: string;
  viewportClass: ViewportClassValue;
}

const MODE_CASES: readonly ModeCaseValue[] = [
  {
    expected: { isAuto: true, kind: '3d', level: 'high' },
    isWebGlAvailable: true,
    preference: undefined,
    title: 'desktop default is auto at the high level',
    viewportClass: 'desktop',
  },
  {
    expected: { isAuto: true, kind: '3d', level: 'medium' },
    isWebGlAvailable: true,
    preference: undefined,
    title: 'tablet default is auto at the medium level',
    viewportClass: 'tablet',
  },
  {
    expected: { kind: 'off', reason: 'phoneDefault' },
    isWebGlAvailable: true,
    preference: undefined,
    title: 'phone default is the light mode',
    viewportClass: 'phone',
  },
  {
    expected: { isAuto: true, kind: '3d', level: 'medium' },
    isWebGlAvailable: true,
    preference: 'auto',
    title: 'phone with auto chosen by hand is auto at the medium level',
    viewportClass: 'phone',
  },
  {
    autoLevel: 'low',
    expected: { isAuto: true, kind: '3d', level: 'low' },
    isWebGlAvailable: true,
    preference: 'auto',
    title: 'auto follows the measured level',
    viewportClass: 'desktop',
  },
  {
    autoLevel: 'low',
    expected: { isAuto: false, kind: '3d', level: 'high' },
    isWebGlAvailable: true,
    preference: 'high',
    title: 'a fixed level ignores the measured level',
    viewportClass: 'desktop',
  },
  {
    expected: { isAuto: false, kind: '3d', level: 'low' },
    isWebGlAvailable: true,
    preference: 'low',
    title: 'low on a phone is a fixed low level',
    viewportClass: 'phone',
  },
  {
    expected: { isAuto: false, kind: '3d', level: 'medium' },
    isWebGlAvailable: true,
    preference: 'medium',
    title: 'medium on a tablet is a fixed medium level',
    viewportClass: 'tablet',
  },
  {
    expected: { kind: 'off', reason: 'preference' },
    isWebGlAvailable: true,
    preference: 'off',
    title: 'off by choice on a desktop',
    viewportClass: 'desktop',
  },
  {
    expected: { kind: 'off', reason: 'preference' },
    isWebGlAvailable: true,
    preference: 'off',
    title: 'off by choice on a phone',
    viewportClass: 'phone',
  },
  {
    expected: { kind: 'off', reason: 'noWebGl' },
    isWebGlAvailable: false,
    preference: undefined,
    title: 'no WebGL on a desktop falls back to the light mode',
    viewportClass: 'desktop',
  },
  {
    expected: { kind: 'off', reason: 'noWebGl' },
    isWebGlAvailable: false,
    preference: 'high',
    title: 'no WebGL beats a fixed level',
    viewportClass: 'tablet',
  },
  {
    expected: { kind: 'off', reason: 'phoneDefault' },
    isWebGlAvailable: false,
    preference: undefined,
    title: 'the phone default is reported before WebGL is considered',
    viewportClass: 'phone',
  },
  {
    expected: { kind: 'off', reason: 'noWebGl' },
    isWebGlAvailable: false,
    preference: 'auto',
    title: 'no WebGL on a phone with auto chosen by hand is reported as no WebGL',
    viewportClass: 'phone',
  },
  {
    expected: { kind: 'off', reason: 'preference' },
    isWebGlAvailable: false,
    preference: 'off',
    title: 'off by choice stays off by choice without WebGL',
    viewportClass: 'desktop',
  },
];

describe('resolveSceneMode', () => {
  it.each(MODE_CASES)('$title', ({ autoLevel, expected, isWebGlAvailable, preference, viewportClass }) => {
    expect(resolveSceneMode({ autoLevel, isWebGlAvailable: () => isWebGlAvailable, preference, viewportClass })).toEqual(expected);
  });

  describe('lazy WebGL probe', () => {
    it.each([
      ['off by choice on a desktop', 'off', 'desktop'],
      ['off by choice on a phone', 'off', 'phone'],
      ['the phone default', undefined, 'phone'],
    ] as const)('does not run the probe for %s', (_title, preference, viewportClass) => {
      const probe = vi.fn(() => false);

      resolveSceneMode({ autoLevel: undefined, isWebGlAvailable: probe, preference, viewportClass });

      expect(probe).not.toHaveBeenCalled();
    });

    it('runs the probe once when the scene could be shown and reports no WebGL', () => {
      const probe = vi.fn(() => false);

      const mode = resolveSceneMode({ autoLevel: undefined, isWebGlAvailable: probe, preference: undefined, viewportClass: 'desktop' });

      expect(probe).toHaveBeenCalledOnce();
      expect(mode).toEqual({ kind: 'off', reason: 'noWebGl' });
    });
  });
});
