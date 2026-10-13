import type { SceneInsetsValue } from './sceneInsetsTypes';

import {
  MIN_FREE_AREA_PX,
  ZERO_SCENE_INSETS,
} from './sceneInsetsTypes';

export const measureSceneInsets = (sceneRect: DOMRectReadOnly, freeRect: DOMRectReadOnly): SceneInsetsValue => {
  const left = Math.max(0, Math.round(freeRect.left - sceneRect.left));
  const top = Math.max(0, Math.round(freeRect.top - sceneRect.top));
  const right = Math.max(0, Math.round(sceneRect.right - freeRect.right));
  const bottom = Math.max(0, Math.round(sceneRect.bottom - freeRect.bottom));

  const freeWidth = Math.round(sceneRect.width) - left - right;
  const freeHeight = Math.round(sceneRect.height) - top - bottom;

  if (freeWidth < MIN_FREE_AREA_PX || freeHeight < MIN_FREE_AREA_PX) {
    return ZERO_SCENE_INSETS;
  }

  return {
    bottom,
    left,
    right,
    top,
  };
};

export const offsetRectByScroll = (rect: DOMRectReadOnly, scrollLeft: number, scrollTop: number): DOMRectReadOnly => {
  const left = rect.left + scrollLeft;
  const top = rect.top + scrollTop;

  return {
    bottom: rect.bottom + scrollTop,
    height: rect.height,
    left,
    right: rect.right + scrollLeft,
    toJSON: () => ({}),
    top,
    width: rect.width,
    x: left,
    y: top,
  };
};

export const areSceneInsetsEqual = (current: SceneInsetsValue, next: SceneInsetsValue): boolean => {
  return current.bottom === next.bottom
    && current.left === next.left
    && current.right === next.right
    && current.top === next.top;
};
