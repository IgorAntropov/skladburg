import {
  BufferGeometry,
  Float32BufferAttribute,
  Uint16BufferAttribute,
} from 'three';

export interface SoftBlobOptionsValue {
  alphas: readonly number[];
  exponent: number;
  radiusShares: readonly number[];
  segments: number;
}

const HALF_SIZE = 0.5;
const POSITION_ITEM_SIZE = 3;
const COLOR_ITEM_SIZE = 4;

const writeRingPoint = (positions: number[], angle: number, share: number, exponent: number): void => {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);

  positions.push(
    Math.sign(cos) * Math.abs(cos) ** exponent * HALF_SIZE * share,
    0,
    Math.sign(sin) * Math.abs(sin) ** exponent * HALF_SIZE * share,
  );
};

export const createSoftBlobGeometry = ({ alphas, exponent, radiusShares, segments }: SoftBlobOptionsValue): BufferGeometry => {
  const positions: number[] = [0, 0, 0];
  const colors: number[] = [1, 1, 1, alphas[0] ?? 0];
  const indices: number[] = [];

  for (const [ringIndex, share] of radiusShares.entries()) {
    const alpha = alphas[ringIndex + 1] ?? 0;

    for (let segment = 0; segment < segments; segment += 1) {
      writeRingPoint(positions, (segment / segments) * Math.PI * 2, share, exponent);
      colors.push(1, 1, 1, alpha);
    }
  }

  const ringStart = (ringIndex: number): number => 1 + ringIndex * segments;

  for (let segment = 0; segment < segments; segment += 1) {
    const next = (segment + 1) % segments;

    indices.push(0, ringStart(0) + next, ringStart(0) + segment);

    for (let ringIndex = 0; ringIndex < radiusShares.length - 1; ringIndex += 1) {
      const inner = ringStart(ringIndex);
      const outer = ringStart(ringIndex + 1);

      indices.push(
        inner + segment,
        inner + next,
        outer + segment,
        inner + next,
        outer + next,
        outer + segment,
      );
    }
  }

  const geometry = new BufferGeometry();

  geometry.setAttribute('position', new Float32BufferAttribute(positions, POSITION_ITEM_SIZE));
  geometry.setAttribute('color', new Float32BufferAttribute(colors, COLOR_ITEM_SIZE));
  geometry.setIndex(new Uint16BufferAttribute(indices, 1));

  return geometry;
};
