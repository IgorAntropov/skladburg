import { lerpRange } from '../layout';
import {
  LAMP_DELAY_RANGE,
  LAMP_DELAY_WEIGHTS,
  WINDOW_DELAY_RANGE,
  WINDOW_DELAY_WEIGHTS,
} from './nightConstants';

interface LampDelayInputValue {
  distanceUnit: number;
  hashUnit: number;
}

interface WindowDelayInputValue {
  cityUnit: number;
  hashUnit: number;
  localUnit: number;
}

const MIN_FARTHEST_DISTANCE_METERS = 1;

export const clampUnit = (value: number): number => Math.min(1, Math.max(0, value));

export const getFarthestCityDistance = (cities: readonly { x: number; z: number }[]): number =>
  Math.max(MIN_FARTHEST_DISTANCE_METERS, ...cities.map(city => Math.hypot(city.x, city.z)));

export const toDistanceUnit = (distance: number, farthest: number): number => clampUnit(distance / farthest);

export const computeLampDelay = ({ distanceUnit, hashUnit }: LampDelayInputValue): number =>
  lerpRange(
    LAMP_DELAY_RANGE,
    clampUnit(LAMP_DELAY_WEIGHTS.distance * distanceUnit + LAMP_DELAY_WEIGHTS.hash * hashUnit),
  );

export const computeWindowDelay = ({ cityUnit, hashUnit, localUnit }: WindowDelayInputValue): number =>
  lerpRange(
    WINDOW_DELAY_RANGE,
    clampUnit(WINDOW_DELAY_WEIGHTS.city * cityUnit + WINDOW_DELAY_WEIGHTS.local * localUnit + WINDOW_DELAY_WEIGHTS.hash * hashUnit),
  );
