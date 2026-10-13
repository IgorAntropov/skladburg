import {
  ISOMETRIC_AZIMUTH_RADIANS,
  QUARTER_TURN_RADIANS,
} from './cameraConstants';

const TURNS_PER_REVOLUTION = 4;

export const azimuthForTurn = (turn: number): number => {
  return ISOMETRIC_AZIMUTH_RADIANS + turn * QUARTER_TURN_RADIANS;
};

export const nextTurn = (turn: number, direction: -1 | 1): number => turn + direction;

export const homeTurn = (turn: number): number => {
  const revolutions = Math.round(turn / TURNS_PER_REVOLUTION);

  return revolutions === 0 ? 0 : revolutions * TURNS_PER_REVOLUTION;
};
