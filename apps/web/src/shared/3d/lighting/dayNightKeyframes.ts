export interface DayNightKeyframeValue {
  exposure: number;
  hemisphereIntensity: number;
  lightAzimuthRadians: number;
  lightElevationRadians: number;
  lightIntensity: number;
  shadowIntensity: number;
}

export const MIN_LIGHT_ELEVATION_RADIANS = 0.2;

export const DAY_NIGHT_TRANSITION_MS = 2500;

export const DAY_NIGHT_KEYFRAMES: Readonly<Record<'day' | 'night' | 'sunset', DayNightKeyframeValue>> = {
  day: {
    exposure: 0.85,
    hemisphereIntensity: 2.5,
    lightAzimuthRadians: 0.588,
    lightElevationRadians: 0.913,
    lightIntensity: 2.35,
    shadowIntensity: 0.75,
  },
  night: {
    exposure: 1,
    hemisphereIntensity: 1.5,
    lightAzimuthRadians: 3.4,
    lightElevationRadians: 0.8,
    lightIntensity: 0.9,
    shadowIntensity: 0.3,
  },
  sunset: {
    exposure: 0.93,
    hemisphereIntensity: 1.6,
    lightAzimuthRadians: 1.75,
    lightElevationRadians: 0.4,
    lightIntensity: 2.3,
    shadowIntensity: 0.65,
  },
};
