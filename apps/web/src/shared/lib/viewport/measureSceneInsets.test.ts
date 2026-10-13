import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  measureSceneInsets,
  offsetRectByScroll,
} from './measureSceneInsets';
import {
  MIN_FREE_AREA_PX,
  ZERO_SCENE_INSETS,
} from './sceneInsetsTypes';

const createRect = (left: number, top: number, width: number, height: number): DOMRectReadOnly => ({
  bottom: top + height,
  height,
  left,
  right: left + width,
  toJSON: () => ({}),
  top,
  width,
  x: left,
  y: top,
});

const SCENE_RECT = createRect(0, 0, 1440, 900);

describe('measureSceneInsets', () => {
  it('measures the gaps between the scene edges and the free area', () => {
    const insets = measureSceneInsets(SCENE_RECT, createRect(400, 80, 600, 700));

    expect(insets).toEqual({
      bottom: 120,
      left: 400,
      right: 440,
      top: 80,
    });
  });

  it('measures from the scene layer when the layer does not start at the origin', () => {
    const insets = measureSceneInsets(createRect(10, 20, 1000, 800), createRect(210, 120, 500, 500));

    expect(insets).toEqual({
      bottom: 200,
      left: 200,
      right: 300,
      top: 100,
    });
  });

  it('rounds the gaps to whole pixels', () => {
    const insets = measureSceneInsets(SCENE_RECT, createRect(400.4, 80.6, 599.2, 700.2));

    expect(insets).toEqual({
      bottom: 119,
      left: 400,
      right: 440,
      top: 81,
    });
  });

  it('clips the gaps of a free area that sticks out of the scene layer', () => {
    const insets = measureSceneInsets(SCENE_RECT, createRect(-50, -30, 1600, 1000));

    expect(insets).toEqual(ZERO_SCENE_INSETS);
  });

  it('keeps the gaps of the side that stays inside when another side sticks out', () => {
    const insets = measureSceneInsets(SCENE_RECT, createRect(-50, 100, 900, 600));

    expect(insets).toEqual({
      bottom: 200,
      left: 0,
      right: 590,
      top: 100,
    });
  });

  it('returns zero gaps for an empty free area', () => {
    expect(measureSceneInsets(SCENE_RECT, createRect(0, 0, 0, 0))).toEqual(ZERO_SCENE_INSETS);
  });

  it('returns zero gaps when the free area is narrower than the minimum', () => {
    const insets = measureSceneInsets(SCENE_RECT, createRect(400, 80, MIN_FREE_AREA_PX - 1, 600));

    expect(insets).toEqual(ZERO_SCENE_INSETS);
  });

  it('returns zero gaps when the free area is lower than the minimum', () => {
    const insets = measureSceneInsets(SCENE_RECT, createRect(400, 80, 600, MIN_FREE_AREA_PX - 1));

    expect(insets).toEqual(ZERO_SCENE_INSETS);
  });

  it('keeps a free area of exactly the minimum size', () => {
    const insets = measureSceneInsets(SCENE_RECT, createRect(400, 80, MIN_FREE_AREA_PX, MIN_FREE_AREA_PX));

    expect(insets.left).toBe(400);
    expect(insets.top).toBe(80);
  });

  it('returns zero gaps when only a thin strip of the free area is left inside the layer', () => {
    const insets = measureSceneInsets(SCENE_RECT, createRect(1400, 80, 600, 600));

    expect(insets).toEqual(ZERO_SCENE_INSETS);
  });
});

describe('offsetRectByScroll', () => {
  it('returns the rect as it lies at zero scroll', () => {
    const shifted = offsetRectByScroll(createRect(400, 30, 600, 700), 0, 50);

    expect(shifted.top).toBe(80);
    expect(shifted.bottom).toBe(780);
    expect(shifted.y).toBe(80);
    expect(shifted.height).toBe(700);
    expect(shifted.left).toBe(400);
    expect(shifted.right).toBe(1000);
  });

  it('shifts the horizontal edges by the horizontal scroll', () => {
    const shifted = offsetRectByScroll(createRect(380, 80, 600, 700), 20, 0);

    expect(shifted.left).toBe(400);
    expect(shifted.right).toBe(1000);
    expect(shifted.x).toBe(400);
    expect(shifted.width).toBe(600);
  });

  it('gives the same insets for any scroll position of the root', () => {
    const atZeroScroll = measureSceneInsets(SCENE_RECT, createRect(400, 80, 600, 700));

    [0, 35, 120, 400].forEach((scrollTop) => {
      const scrolledFreeRect = createRect(400, 80 - scrollTop, 600, 700);
      const insets = measureSceneInsets(SCENE_RECT, offsetRectByScroll(scrolledFreeRect, 0, scrollTop));

      expect(insets).toEqual(atZeroScroll);
    });
  });
});
