import {
  Color,
  MathUtils,
  Vector3,
} from 'three';

import type { RgbaColorValue } from '@/shared/lib/color';

import type { WorldPaletteValue } from '../palette/worldPaletteKeys';

import { applyRgbaColor } from '../world/applyRgbaColor';
import {
  DAY_NIGHT_KEYFRAMES,
  MIN_LIGHT_ELEVATION_RADIANS,
} from './dayNightKeyframes';

export interface DayNightLightingValue {
  background: Color;
  hemisphereGround: Color;
  hemisphereIntensity: number;
  hemisphereSky: Color;
  lightColor: Color;
  lightDirection: Vector3;
  lightIntensity: number;
  shadowIntensity: number;
}

const SUNSET_VALUE = 0.5;
const SEGMENT_SPAN = 2;

const FROM_COLOR = new Color();
const TO_COLOR = new Color();

export const createDayNightLightingValue = (): DayNightLightingValue => {
  return {
    background: new Color(),
    hemisphereGround: new Color(),
    hemisphereIntensity: 0,
    hemisphereSky: new Color(),
    lightColor: new Color(),
    lightDirection: new Vector3(),
    lightIntensity: 0,
    shadowIntensity: 0,
  };
};

const mixPaletteColor = (target: Color, from: RgbaColorValue, to: RgbaColorValue, amount: number): void => {
  applyRgbaColor(FROM_COLOR, from);

  if (amount <= 0) {
    target.copy(FROM_COLOR);

    return;
  }

  applyRgbaColor(TO_COLOR, to);

  if (amount >= 1) {
    target.copy(TO_COLOR);

    return;
  }

  target.lerpColors(FROM_COLOR, TO_COLOR, amount);
};

export const computeDayNightLighting = (value: number, palette: WorldPaletteValue, out: DayNightLightingValue): void => {
  const clamped = MathUtils.clamp(value, 0, 1);
  const isBeforeSunset = clamped <= SUNSET_VALUE;
  const segmentAmount = isBeforeSunset ? clamped * SEGMENT_SPAN : (clamped - SUNSET_VALUE) * SEGMENT_SPAN;
  const from = isBeforeSunset ? DAY_NIGHT_KEYFRAMES.day : DAY_NIGHT_KEYFRAMES.sunset;
  const to = isBeforeSunset ? DAY_NIGHT_KEYFRAMES.sunset : DAY_NIGHT_KEYFRAMES.night;

  out.hemisphereIntensity = MathUtils.lerp(from.hemisphereIntensity, to.hemisphereIntensity, segmentAmount);
  out.lightIntensity = MathUtils.lerp(from.lightIntensity, to.lightIntensity, segmentAmount);
  out.shadowIntensity = MathUtils.lerp(from.shadowIntensity, to.shadowIntensity, segmentAmount);

  const azimuth = MathUtils.lerp(from.lightAzimuthRadians, to.lightAzimuthRadians, segmentAmount);
  const elevation = Math.max(
    MIN_LIGHT_ELEVATION_RADIANS,
    MathUtils.lerp(from.lightElevationRadians, to.lightElevationRadians, segmentAmount),
  );
  const horizontal = Math.cos(elevation);

  out.lightDirection.set(horizontal * Math.sin(azimuth), Math.sin(elevation), horizontal * Math.cos(azimuth));

  mixPaletteColor(
    out.lightColor,
    isBeforeSunset ? palette.sunDay : palette.sunSunset,
    isBeforeSunset ? palette.sunSunset : palette.moon,
    segmentAmount,
  );
  mixPaletteColor(
    out.hemisphereSky,
    isBeforeSunset ? palette.skyDay : palette.skySunset,
    isBeforeSunset ? palette.skySunset : palette.skyNight,
    segmentAmount,
  );
  mixPaletteColor(out.hemisphereGround, palette.groundDay, palette.groundNight, clamped);
  mixPaletteColor(out.background, palette.background, palette.backgroundNight, clamped);
};
