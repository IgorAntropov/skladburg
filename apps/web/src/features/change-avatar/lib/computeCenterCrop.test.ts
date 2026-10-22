import {
  describe,
  expect,
  it,
} from 'vitest';

import { computeCenterCrop } from './computeCenterCrop';

describe('computeCenterCrop', () => {
  it('takes the whole picture when it is already square', () => {
    expect(computeCenterCrop(300, 300)).toEqual({ size: 300, sx: 0, sy: 0 });
  });

  it('cuts equal bands from the sides of a landscape picture', () => {
    expect(computeCenterCrop(1600, 900)).toEqual({ size: 900, sx: 350, sy: 0 });
  });

  it('cuts equal bands from the top and the bottom of a portrait picture', () => {
    expect(computeCenterCrop(900, 1600)).toEqual({ size: 900, sx: 0, sy: 350 });
  });

  it('rounds the offset down when the difference is odd', () => {
    expect(computeCenterCrop(101, 50)).toEqual({ size: 50, sx: 25, sy: 0 });
  });
});
