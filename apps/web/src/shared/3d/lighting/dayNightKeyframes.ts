export interface DayNightKeyframeValue {
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
    hemisphereIntensity: 2,
    lightAzimuthRadians: 0.588,
    lightElevationRadians: 0.913,
    lightIntensity: 2.2,
    shadowIntensity: 0.75,
  },
  night: {
    hemisphereIntensity: 1.5,
    lightAzimuthRadians: 3.4,
    lightElevationRadians: 0.8,
    lightIntensity: 0.9,
    shadowIntensity: 0.3,
  },
  sunset: {
    hemisphereIntensity: 1.5,
    lightAzimuthRadians: 1.75,
    lightElevationRadians: 0.4,
    lightIntensity: 2.1,
    shadowIntensity: 0.65,
  },
};
