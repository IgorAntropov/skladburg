import {
  describe,
  expect,
  it,
} from 'vitest';

import type { PointerSampleValue } from './isTapGesture';

import {
  isTapGesture,
  TAP_SLOP_PX,
} from './isTapGesture';

const createSample = (overrides: Partial<PointerSampleValue> = {}): PointerSampleValue => ({
  button: 0,
  pointerId: 1,
  pointerType: 'touch',
  x: 100,
  y: 100,
  ...overrides,
});

describe('isTapGesture', () => {
  it('counts a press and a release at the same point as a tap', () => {
    expect(isTapGesture(createSample(), createSample())).toBe(true);
  });

  it('counts a shift under the slop as a tap', () => {
    expect(isTapGesture(createSample(), createSample({ x: 104.9 }))).toBe(true);
    expect(isTapGesture(createSample(), createSample({ x: 103, y: 104 }))).toBe(true);
  });

  it('counts a shift over the slop as a drag', () => {
    expect(isTapGesture(createSample(), createSample({ x: 105.1 }))).toBe(false);
    expect(isTapGesture(createSample(), createSample({ x: 104, y: 104 }))).toBe(false);
  });

  it('uses five pixels by default and a given slop when there is one', () => {
    expect(TAP_SLOP_PX).toBe(5);
    expect(isTapGesture(createSample(), createSample({ x: 108 }), 10)).toBe(true);
    expect(isTapGesture(createSample(), createSample({ x: 102 }), 1)).toBe(false);
  });

  it('is not a tap when the pointer differs', () => {
    expect(isTapGesture(createSample(), createSample({ pointerId: 2 }))).toBe(false);
  });

  it('is not a tap with a secondary button', () => {
    expect(isTapGesture(createSample({ button: 2 }), createSample({ button: 2 }))).toBe(false);
    expect(isTapGesture(createSample(), createSample({ button: 2 }))).toBe(false);
    expect(isTapGesture(createSample({ button: 1 }), createSample())).toBe(false);
  });
});
