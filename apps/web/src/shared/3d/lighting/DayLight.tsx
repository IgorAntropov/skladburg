import type { ReactElement } from 'react';

import { useMemo } from 'react';
import { Color } from 'three';

import { useWorldPalette } from '../materials/useWorldPalette';
import { applyRgbaColor } from '../world/applyRgbaColor';

const HEMISPHERE_INTENSITY = 1.2;
const SUN_INTENSITY = 2.2;
const SUN_POSITION: [number, number, number] = [6, 14, 9];

export const DayLight = (): ReactElement => {
  const palette = useWorldPalette();

  const skyColor = useMemo(() => applyRgbaColor(new Color(), palette.skyDay), [palette]);
  const groundColor = useMemo(() => applyRgbaColor(new Color(), palette.groundDay), [palette]);
  const sunColor = useMemo(() => applyRgbaColor(new Color(), palette.sunDay), [palette]);

  return (
    <>
      <hemisphereLight color={skyColor} groundColor={groundColor} intensity={HEMISPHERE_INTENSITY} />
      <directionalLight color={sunColor} intensity={SUN_INTENSITY} position={SUN_POSITION} />
    </>
  );
};
