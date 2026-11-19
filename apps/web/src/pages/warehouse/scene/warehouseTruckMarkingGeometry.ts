import {
  BufferAttribute,
  BufferGeometry,
} from 'three';

interface MarkingMountValue {
  center: readonly [number, number, number];
  height: number;
  width: number;
  yaw: number;
}

const MOUNTS: readonly MarkingMountValue[] = [
  { center: [0, 0.208, -3.06], height: 0.29, width: 1.16, yaw: Math.PI },
  { center: [0, 0.275, 2.945], height: 0.29, width: 1.16, yaw: 0 },
  { center: [0.71, 0.9, -1.94], height: 0.3, width: 1.05, yaw: Math.PI / 2 },
  { center: [-0.71, 0.9, -1.94], height: 0.3, width: 1.05, yaw: -Math.PI / 2 },
];

export const WAREHOUSE_TRUCK_MARKING_UV = 'yardMarkingUv';

const CORNERS = [[0, 0], [1, 0], [1, 1], [0, 1]] as const;
const MARKING_GUTTER = 0.005;

export const createWarehouseTruckMarkingGeometry = (body: BufferGeometry): BufferGeometry => {
  const basePositions = body.getAttribute('position');
  const baseIndices = body.getIndex();
  const baseIndexCount = baseIndices?.count ?? 0;
  const vertexCount = basePositions.count + MOUNTS.length * CORNERS.length;
  const positions = new Float32Array(vertexCount * 3);
  const markingUvs = new Float32Array(vertexCount * 3);
  const indices = new Uint16Array(baseIndexCount + MOUNTS.length * 6);
  positions.set(basePositions.array);
  if (baseIndices !== null) {
    indices.set(baseIndices.array);
  }

  for (const [index, { center: [x, y, z], height, width, yaw }] of MOUNTS.entries()) {
    const start = basePositions.count + index * CORNERS.length;
    const vOffset = index < 2 ? 0 : 0.5;
    const cosine = Math.cos(yaw);
    const sine = Math.sin(yaw);
    for (const [corner, [u, v]] of CORNERS.entries()) {
      const offset = (start + corner) * 3;
      const dx = (u - 0.5) * width;
      positions[offset] = x + dx * cosine;
      positions[offset + 1] = y + (v - 0.5) * height;
      positions[offset + 2] = z - dx * sine;
      markingUvs[offset] = MARKING_GUTTER + u * (1 - 2 * MARKING_GUTTER);
      markingUvs[offset + 1] = vOffset + MARKING_GUTTER + v * (0.5 - 2 * MARKING_GUTTER);
      markingUvs[offset + 2] = 1;
    }
    indices.set([start, start + 1, start + 2, start, start + 2, start + 3], baseIndexCount + index * 6);
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(positions, 3));
  geometry.setAttribute('color', new BufferAttribute(new Uint8Array(positions.length), 3, true));
  geometry.setAttribute(WAREHOUSE_TRUCK_MARKING_UV, new BufferAttribute(markingUvs, 3));
  geometry.setIndex(new BufferAttribute(indices, 1));
  geometry.computeBoundingSphere();

  return geometry;
};
