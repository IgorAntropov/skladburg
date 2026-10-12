import type { Scene } from 'three';

import { Color } from 'three';

import type { RgbaColorValue } from '@/shared/lib/color';

import { applyRgbaColor } from './applyRgbaColor';

export const setSceneBackground = (scene: Scene, color: RgbaColorValue | undefined): void => {
  scene.background = color === undefined ? null : applyRgbaColor(new Color(), color);
};
