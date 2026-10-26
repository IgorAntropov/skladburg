import { Color } from 'three';
import {
  describe,
  expect,
  it,
} from 'vitest';

import type { RgbaColorValue } from '@/shared/lib/color';

import type { WorldPaletteValue } from '../palette/worldPaletteKeys';
import type { DayNightLightingValue } from './computeDayNightLighting';

import { applyRgbaColor } from '../world/applyRgbaColor';
import {
  computeDayNightLighting,
  createDayNightLightingValue,
} from './computeDayNightLighting';
import {
  DAY_NIGHT_KEYFRAMES,
  MIN_LIGHT_ELEVATION_RADIANS,
} from './dayNightKeyframes';

const rgb = (red: number, green: number, blue: number): RgbaColorValue => {
  return {
    alpha: 1,
    blue,
    green,
    red,
  };
};

const PALETTE: WorldPaletteValue = {
  background: rgb(200, 210, 120),
  backgroundNight: rgb(20, 30, 70),
  bannerPlate: rgb(250, 245, 233),
  bannerText: rgb(30, 42, 74),
  buildingBrick: rgb(181, 105, 79),
  buildingRoof: rgb(181, 105, 79),
  buildingRoofAlt: rgb(196, 154, 88),
  buildingWall: rgb(236, 228, 212),
  field: rgb(1, 2, 3),
  fieldAlt: rgb(4, 5, 6),
  ground: rgb(7, 8, 9),
  groundAlt: rgb(10, 11, 12),
  groundDay: rgb(90, 140, 70),
  groundNight: rgb(10, 20, 60),
  lampGlow: rgb(255, 241, 194),
  lightPool: rgb(255, 207, 142),
  moon: rgb(120, 150, 255),
  plaza: rgb(190, 193, 186),
  road: rgb(103, 107, 113),
  rock: rgb(13, 14, 15),
  sand: rgb(16, 17, 18),
  sideCarrier: rgb(110, 40, 94),
  sideCustomer: rgb(131, 68, 185),
  sideRim: rgb(255, 255, 255),
  sideSupplier: rgb(89, 101, 23),
  skyDay: rgb(190, 220, 255),
  skyNight: rgb(15, 25, 90),
  skySunset: rgb(250, 160, 110),
  sunDay: rgb(255, 245, 220),
  sunSunset: rgb(255, 140, 60),
  treeCrown: rgb(19, 20, 21),
  treeCrownDark: rgb(22, 23, 24),
  treeTrunk: rgb(25, 26, 27),
  warehouseRoof: rgb(127, 141, 164),
  warehouseWall: rgb(211, 218, 224),
  water: rgb(28, 29, 30),
  windowGlass: rgb(38, 46, 64),
  windowGlow: rgb(255, 210, 127),
};

const STEPS = 200;
const EPSILON = 1e-9;

const toColor = (source: RgbaColorValue): Color => {
  return applyRgbaColor(new Color(), source);
};

const compute = (value: number): DayNightLightingValue => {
  const out = createDayNightLightingValue();
  computeDayNightLighting(value, PALETTE, out);

  return out;
};

describe('computeDayNightLighting', () => {
  it('matches the day keyframe at zero', () => {
    const out = compute(0);

    expect(out.exposure).toBe(DAY_NIGHT_KEYFRAMES.day.exposure);
    expect(out.hemisphereIntensity).toBe(DAY_NIGHT_KEYFRAMES.day.hemisphereIntensity);
    expect(out.lightIntensity).toBe(DAY_NIGHT_KEYFRAMES.day.lightIntensity);
    expect(out.shadowIntensity).toBe(DAY_NIGHT_KEYFRAMES.day.shadowIntensity);
    expect(out.lightColor.equals(toColor(PALETTE.sunDay))).toBe(true);
    expect(out.hemisphereSky.equals(toColor(PALETTE.skyDay))).toBe(true);
    expect(out.hemisphereGround.equals(toColor(PALETTE.groundDay))).toBe(true);
    expect(out.background.equals(toColor(PALETTE.background))).toBe(true);
  });

  it('matches the sunset keyframe at one half', () => {
    const out = compute(0.5);

    expect(out.exposure).toBe(DAY_NIGHT_KEYFRAMES.sunset.exposure);
    expect(out.hemisphereIntensity).toBe(DAY_NIGHT_KEYFRAMES.sunset.hemisphereIntensity);
    expect(out.lightIntensity).toBe(DAY_NIGHT_KEYFRAMES.sunset.lightIntensity);
    expect(out.shadowIntensity).toBe(DAY_NIGHT_KEYFRAMES.sunset.shadowIntensity);
    expect(out.lightColor.equals(toColor(PALETTE.sunSunset))).toBe(true);
    expect(out.hemisphereSky.equals(toColor(PALETTE.skySunset))).toBe(true);
  });

  it('mixes the ground and the background halfway at sunset', () => {
    const out = compute(0.5);
    const expectedGround = new Color().lerpColors(toColor(PALETTE.groundDay), toColor(PALETTE.groundNight), 0.5);
    const expectedBackground = new Color().lerpColors(toColor(PALETTE.background), toColor(PALETTE.backgroundNight), 0.5);

    expect(out.hemisphereGround.equals(expectedGround)).toBe(true);
    expect(out.background.equals(expectedBackground)).toBe(true);
  });

  it('matches the night keyframe at one', () => {
    const out = compute(1);

    expect(out.exposure).toBe(DAY_NIGHT_KEYFRAMES.night.exposure);
    expect(out.hemisphereIntensity).toBe(DAY_NIGHT_KEYFRAMES.night.hemisphereIntensity);
    expect(out.lightIntensity).toBe(DAY_NIGHT_KEYFRAMES.night.lightIntensity);
    expect(out.shadowIntensity).toBe(DAY_NIGHT_KEYFRAMES.night.shadowIntensity);
    expect(out.lightColor.equals(toColor(PALETTE.moon))).toBe(true);
    expect(out.hemisphereSky.equals(toColor(PALETTE.skyNight))).toBe(true);
    expect(out.hemisphereGround.equals(toColor(PALETTE.groundNight))).toBe(true);
    expect(out.background.equals(toColor(PALETTE.backgroundNight))).toBe(true);
  });

  it('mixes the exposure halfway along each segment', () => {
    const { day, night, sunset } = DAY_NIGHT_KEYFRAMES;

    expect(compute(0.25).exposure).toBeCloseTo((day.exposure + sunset.exposure) / 2, 9);
    expect(compute(0.75).exposure).toBeCloseTo((sunset.exposure + night.exposure) / 2, 9);
  });

  it('keeps the exposure between the keyframe values and never lowers it on the way to the night', () => {
    const { day, night } = DAY_NIGHT_KEYFRAMES;
    let previousExposure = Number.NEGATIVE_INFINITY;

    for (let step = 0; step <= STEPS; step += 1) {
      const { exposure } = compute(step / STEPS);

      expect(exposure).toBeGreaterThanOrEqual(Math.min(day.exposure, night.exposure) - EPSILON);
      expect(exposure).toBeLessThanOrEqual(Math.max(day.exposure, night.exposure) + EPSILON);
      expect(exposure).toBeGreaterThanOrEqual(previousExposure - EPSILON);
      previousExposure = exposure;
    }
  });

  it('points the light along the keyframe angles at the keyframes', () => {
    const keyframes = [
      [0, DAY_NIGHT_KEYFRAMES.day],
      [0.5, DAY_NIGHT_KEYFRAMES.sunset],
      [1, DAY_NIGHT_KEYFRAMES.night],
    ] as const;

    keyframes.forEach(([value, keyframe]) => {
      const { lightDirection } = compute(value);

      expect(Math.asin(lightDirection.y)).toBeCloseTo(keyframe.lightElevationRadians, 9);
      expect(Math.atan2(lightDirection.x, lightDirection.z)).toBeCloseTo(
        Math.atan2(Math.sin(keyframe.lightAzimuthRadians), Math.cos(keyframe.lightAzimuthRadians)),
        9,
      );
    });
  });

  it('never makes the total light stronger on the way to the night', () => {
    let previousTotal = Number.POSITIVE_INFINITY;

    for (let step = 0; step <= STEPS; step += 1) {
      const out = compute(step / STEPS);
      const total = out.hemisphereIntensity + out.lightIntensity;

      expect(total).toBeLessThanOrEqual(previousTotal + EPSILON);
      previousTotal = total;
    }
  });

  it('keeps the light direction a unit vector above the minimum elevation along the whole path', () => {
    for (let step = 0; step <= STEPS; step += 1) {
      const { lightDirection } = compute(step / STEPS);

      expect(lightDirection.length()).toBeCloseTo(1, 9);
      expect(Math.asin(lightDirection.y)).toBeGreaterThanOrEqual(MIN_LIGHT_ELEVATION_RADIANS - EPSILON);
    }
  });

  it('keeps every keyframe above the minimum elevation', () => {
    Object.values(DAY_NIGHT_KEYFRAMES).forEach((keyframe) => {
      expect(keyframe.lightElevationRadians).toBeGreaterThanOrEqual(MIN_LIGHT_ELEVATION_RADIANS);
    });
  });

  it('clamps values outside the range to the ends', () => {
    const day = compute(0);
    const night = compute(1);

    [-5, -0.001].forEach((value) => {
      const out = compute(value);

      expect(out.lightIntensity).toBe(day.lightIntensity);
      expect(out.exposure).toBe(day.exposure);
      expect(out.lightDirection.equals(day.lightDirection)).toBe(true);
      expect(out.background.equals(day.background)).toBe(true);
    });
    [1.001, 7].forEach((value) => {
      const out = compute(value);

      expect(out.lightIntensity).toBe(night.lightIntensity);
      expect(out.exposure).toBe(night.exposure);
      expect(out.lightDirection.equals(night.lightDirection)).toBe(true);
      expect(out.background.equals(night.background)).toBe(true);
    });
  });

  it('writes into the same object and keeps its color and vector references', () => {
    const out = createDayNightLightingValue();
    const { background, hemisphereGround, hemisphereSky, lightColor, lightDirection } = out;

    computeDayNightLighting(0.3, PALETTE, out);
    computeDayNightLighting(0.8, PALETTE, out);

    expect(out.background).toBe(background);
    expect(out.hemisphereGround).toBe(hemisphereGround);
    expect(out.hemisphereSky).toBe(hemisphereSky);
    expect(out.lightColor).toBe(lightColor);
    expect(out.lightDirection).toBe(lightDirection);
  });
});
