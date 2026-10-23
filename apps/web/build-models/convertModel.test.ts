import {
  describe,
  expect,
  it,
} from 'vitest';

import type { PngImageValue } from './decodePng.ts';

import { readWorldModel } from '../src/pages/network/scene/models/format/worldModelFormat.ts';
import { convertGlbToWorldModel } from './convertModel.ts';
import {
  assembleGlb,
  createGlbParts,
} from './glbFixtures.ts';

const createColormap = (): PngImageValue => {
  const data = new Uint8ClampedArray(64 * 64 * 4).fill(255);

  for (let pixel = 0; pixel < 64 * 64; pixel += 1) {
    data[pixel * 4] = 142;
    data[pixel * 4 + 1] = 149;
    data[pixel * 4 + 2] = 179;
  }

  return { data, height: 64, width: 64 };
};

describe('convertGlbToWorldModel', () => {
  it('turns a GLB into a readable file with a report', () => {
    const { bytes, report } = convertGlbToWorldModel(assembleGlb(createGlbParts({ hasSecondPrimitive: true })), createColormap());
    const data = readWorldModel(bytes.buffer);

    expect(report.bytes).toBe(bytes.length);
    expect(report.triangles).toEqual({ afterDownFaces: 3, afterWeld: 3, degenerate: 0, flipped: 0, source: 3 });
    expect(report.vertices).toEqual({ afterDownFaces: 4, afterWeld: 4, source: 4 });
    expect(report.roleHistogram.mid).toBe(4);
    expect(data.triangleCount).toBe(3);
  });

  it('reports the same size before and after within one quantization step', () => {
    const { report } = convertGlbToWorldModel(assembleGlb(createGlbParts()), createColormap());

    expect(report.sizeSource).toEqual([1, 1, 0]);

    for (const [axis, size] of report.sizeWritten.entries()) {
      expect(Math.abs(size - (report.sizeSource[axis] ?? 0))).toBeLessThanOrEqual(1 / 65535);
    }
  });

  it('produces identical bytes for two runs', () => {
    const glb = assembleGlb(createGlbParts({ hasSecondPrimitive: true, isInterleaved: true }));

    expect(convertGlbToWorldModel(glb, createColormap()).bytes).toEqual(convertGlbToWorldModel(glb, createColormap()).bytes);
  });
});
