import {
  describe,
  expect,
  it,
} from 'vitest';

import { hashFnv1a32 } from './hashFnv1a32';
import { pickAvatarTone } from './pickAvatarTone';

const TONE_COUNT = 8;

const createPersonaUserId = (number: number): string => `200000${String(number).padStart(2, '0')}-0000-4000-8000-000000000000`;

describe('hashFnv1a32', () => {
  it('returns the offset basis for an empty string', () => {
    expect(hashFnv1a32('')).toBe(0x811C9DC5);
  });

  it('matches the reference values', () => {
    expect(hashFnv1a32('a')).toBe(3826002220);
    expect(hashFnv1a32('foobar')).toBe(3214735720);
  });

  it('hashes UTF-8 bytes of non-ASCII text', () => {
    expect(hashFnv1a32('Ё')).toBe(hashFnv1a32('Ё'));
    expect(hashFnv1a32('Ё')).not.toBe(hashFnv1a32('E'));
  });
});

describe('pickAvatarTone', () => {
  it('returns the index of the tone: hash modulo tone count', () => {
    expect(pickAvatarTone('a', TONE_COUNT)).toBe(3826002220 % TONE_COUNT);
    expect(pickAvatarTone('foobar', TONE_COUNT)).toBe(3214735720 % TONE_COUNT);
  });

  it.each([
    [1, 5],
    [2, 6],
    [4, 4],
    [5, 1],
    [6, 2],
    [8, 8],
    [10, 7],
    [11, 2],
  ])('gives the demo user %i the tone number %i', (userNumber, toneNumber) => {
    expect(pickAvatarTone(createPersonaUserId(userNumber), TONE_COUNT) + 1).toBe(toneNumber);
  });

  it('is stable between calls', () => {
    const seed = createPersonaUserId(3);

    expect(pickAvatarTone(seed, TONE_COUNT)).toBe(pickAvatarTone(seed, TONE_COUNT));
  });

  it('stays within the range for many seeds and tone counts', () => {
    const indexes = Array.from({ length: 200 }, (_, number) => pickAvatarTone(`seed-${String(number)}`, TONE_COUNT));

    expect(indexes.every(index => Number.isInteger(index) && index >= 0 && index < TONE_COUNT)).toBe(true);
    expect(new Set(indexes).size).toBe(TONE_COUNT);
    expect(pickAvatarTone('seed', 1)).toBe(0);
  });
});
