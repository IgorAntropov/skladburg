import { Vector3 } from 'three';
import {
  describe,
  expect,
  it,
} from 'vitest';

import { buildPlazaMatrices } from './buildPlazaMatrices';

describe('buildPlazaMatrices', () => {
  it('stands every plaza on the ground at the city center with the radius of the city', () => {
    const matrices = buildPlazaMatrices([{ radius: 6.4, x: 12, z: -30 }, { radius: 9.6, x: -50, z: 8 }]);

    expect(matrices).toHaveLength(32);

    const second = new Vector3().fromArray(matrices, 16 + 12);

    expect(new Vector3().fromArray(matrices, 12).toArray()).toEqual([12, 0, -30]);
    expect(second.toArray()).toEqual([-50, 0, 8]);
    expect(matrices[0]).toBeCloseTo(6.4, 5);
    expect(matrices[5]).toBeCloseTo(0.1, 5);
    expect(matrices[16]).toBeCloseTo(9.6, 5);
  });

  it('returns an empty buffer for no cities', () => {
    expect(buildPlazaMatrices([])).toHaveLength(0);
  });
});
