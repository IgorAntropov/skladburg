import {
  describe,
  expect,
  it,
} from 'vitest';

import type {
  CameraModeEventValue,
  CameraModeValue,
} from './cameraMode';

import {
  INITIAL_CAMERA_MODE,
  reduceCameraMode,
} from './cameraMode';

const run = (start: CameraModeValue, events: CameraModeEventValue[]): CameraModeValue => {
  return events.reduce<CameraModeValue>(reduceCameraMode, start);
};

describe('reduceCameraMode', () => {
  it('starts free', () => {
    expect(INITIAL_CAMERA_MODE).toBe('free');
  });

  it('flies and returns to free when the camera comes to rest', () => {
    expect(run('free', [{ kind: 'flyTo' }])).toBe('flying');
    expect(run('free', [{ kind: 'flyTo' }, { kind: 'rest' }])).toBe('free');
  });

  it('keeps following when the camera rests', () => {
    expect(run('free', [{ kind: 'follow' }, { kind: 'rest' }])).toBe('following');
  });

  it.each<[string, CameraModeEventValue]>([
    ['a user gesture', { kind: 'userGesture' }],
    ['home', { kind: 'home' }],
    ['a flight', { kind: 'flyTo' }],
    ['unfollow', { kind: 'unfollow' }],
  ])('stops following on %s', (_, event) => {
    expect(run('following', [event])).not.toBe('following');
  });

  it('keeps following through rotation and zoom', () => {
    expect(run('following', [{ kind: 'rotate' }, { kind: 'zoom' }, { kind: 'rotate' }])).toBe('following');
  });

  it('keeps flying through rotation and zoom', () => {
    expect(run('flying', [{ kind: 'rotate' }, { kind: 'zoom' }])).toBe('flying');
  });

  it('lets a gesture and home interrupt a flight', () => {
    expect(run('flying', [{ kind: 'userGesture' }])).toBe('free');
    expect(run('flying', [{ kind: 'home' }])).toBe('free');
  });

  it('replaces a flight with following and following with a flight', () => {
    expect(run('flying', [{ kind: 'follow' }])).toBe('following');
    expect(run('following', [{ kind: 'flyTo' }])).toBe('flying');
  });

  it('does not change a flight by unfollow and stays free when nothing happens', () => {
    expect(run('flying', [{ kind: 'unfollow' }])).toBe('flying');
    expect(run('free', [{ kind: 'rest' }, { kind: 'rotate' }, { kind: 'zoom' }, { kind: 'unfollow' }])).toBe('free');
  });
});
