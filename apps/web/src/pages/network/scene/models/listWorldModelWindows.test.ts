import {
  describe,
  expect,
  it,
} from 'vitest';

import type { WorldModelFaceValue } from './worldModelCatalog';
import type {
  TestCornerValue,
  TestTriangleValue,
} from './worldModelTestSupport';

import { WORLD_MODEL_ROLES } from './format/worldModelFormat';
import { listWorldModelWindows } from './listWorldModelWindows';
import { createTrianglesWorldModel } from './worldModelTestSupport';

const GLASS = WORLD_MODEL_ROLES.indexOf('glass');
const DARK = WORLD_MODEL_ROLES.indexOf('dark');
const FORWARD_FACES: readonly WorldModelFaceValue[] = ['positiveZ', 'negativeX'];

interface TestQuadValue {
  face: WorldModelFaceValue;
  horizontal: readonly [number, number];
  plane: number;
  role?: number;
  vertical: readonly [number, number];
}

const createCorner = (face: WorldModelFaceValue, plane: number, horizontal: number, vertical: number): TestCornerValue => (
  face === 'positiveZ' || face === 'negativeZ' ? [horizontal, vertical, plane] : [plane, vertical, horizontal]
);

const createQuad = ({ face, horizontal, plane, role = GLASS, vertical }: TestQuadValue): TestTriangleValue[] => {
  const [first, second] = horizontal;
  const [low, high] = vertical;
  const a = createCorner(face, plane, first, low);
  const b = createCorner(face, plane, second, low);
  const c = createCorner(face, plane, second, high);
  const d = createCorner(face, plane, first, high);

  return FORWARD_FACES.includes(face)
    ? [{ corners: [a, b, c], role }, { corners: [a, c, d], role }]
    : [{ corners: [a, c, b], role }, { corners: [a, d, c], role }];
};

const createFanQuad = ({ face, horizontal, plane, role = GLASS, vertical }: TestQuadValue): TestTriangleValue[] => {
  const [first, second] = horizontal;
  const [low, high] = vertical;
  const a = createCorner(face, plane, first, low);
  const b = createCorner(face, plane, second, low);
  const c = createCorner(face, plane, second, high);
  const d = createCorner(face, plane, first, high);
  const middle = createCorner(face, plane, (first + second) / 2, (low + high) / 2);
  const forward: TestTriangleValue[] = [
    { corners: [a, b, middle], role },
    { corners: [b, c, middle], role },
    { corners: [c, d, middle], role },
    { corners: [d, a, middle], role },
  ];

  return FORWARD_FACES.includes(face)
    ? forward
    : forward.map(({ corners: [x, y, z], role: triangleRole }) => ({ corners: [x, z, y], role: triangleRole }));
};

const FRONT: TestQuadValue = { face: 'positiveZ', horizontal: [-0.2, 0.1], plane: 0.4, vertical: [0.1, 0.5] };
const BACK: TestQuadValue = { face: 'negativeZ', horizontal: [0.2, 0.6], plane: -0.4, vertical: [0.3, 0.45] };

describe('listWorldModelWindows', () => {
  it('turns the two triangles of a glass quad into one window with its centre and size', () => {
    const [window, ...rest] = listWorldModelWindows(createTrianglesWorldModel(createQuad(FRONT)));

    expect(rest).toEqual([]);
    expect(window?.face).toBe('positiveZ');
    expect(window?.width).toBeCloseTo(0.3, 5);
    expect(window?.height).toBeCloseTo(0.4, 5);
    expect(window?.center[0]).toBeCloseTo(-0.05, 5);
    expect(window?.center[1]).toBeCloseTo(0.3, 5);
    expect(window?.center[2]).toBeCloseTo(0.4, 5);
  });

  it('joins a quad of four triangles into one window and keeps two separate quads apart', () => {
    expect(listWorldModelWindows(createTrianglesWorldModel(createFanQuad(FRONT)))).toHaveLength(1);
    expect(listWorldModelWindows(createTrianglesWorldModel([...createQuad(FRONT), ...createQuad(BACK)]))).toHaveLength(2);
  });

  it('joins triangles by the position of their corners, not by shared vertices', () => {
    const triangles = createQuad({ ...FRONT, horizontal: [0.2, 0.2 + 1 / 3], vertical: [0.1, 0.1 + 1 / 7] });

    expect(listWorldModelWindows(createTrianglesWorldModel(triangles))).toHaveLength(1);
  });

  it('ignores the triangles that are not entirely glass', () => {
    const data = createTrianglesWorldModel([
      ...createQuad(FRONT),
      ...createQuad({ ...BACK, role: DARK }),
      ...createQuad({ face: 'positiveX', horizontal: [-0.3, 0.3], plane: 0.9, vertical: [0.1, 0.4] }),
    ]);

    data.roles[12] = DARK;

    const windows = listWorldModelWindows(data);

    expect(windows.map(window => window.face)).toEqual(['positiveZ']);
  });

  it('takes the face from the sign of the normal', () => {
    const faces: readonly WorldModelFaceValue[] = ['positiveZ', 'positiveX', 'negativeZ', 'negativeX'];
    const data = createTrianglesWorldModel(faces.flatMap((face, index) => createQuad({
      face,
      horizontal: [-0.1, 0.1],
      plane: face.startsWith('positive') ? 0.5 : -0.5,
      vertical: [0.1 * (index + 1), 0.1 * (index + 1) + 0.05],
    })));

    expect(listWorldModelWindows(data).map(window => window.face)).toEqual(faces);
  });

  it('gives the same windows in the same order whatever the order of the triangles', () => {
    const triangles = [...createQuad(FRONT), ...createQuad(BACK), ...createFanQuad({ ...FRONT, horizontal: [0.3, 0.5] })];
    const forward = listWorldModelWindows(createTrianglesWorldModel(triangles));
    const reversed = listWorldModelWindows(createTrianglesWorldModel(triangles.toReversed()));

    expect(forward).toHaveLength(3);
    expect(reversed).toEqual(forward);
  });

  it('skips glass that is not a vertical flat rectangle', () => {
    const lying: TestTriangleValue[] = [
      { corners: [[0, 0.3, 0], [0.2, 0.3, 0], [0.2, 0.3, 0.2]], role: GLASS },
      { corners: [[0, 0.3, 0], [0.2, 0.3, 0.2], [0, 0.3, 0.2]], role: GLASS },
    ];
    const leaning: TestTriangleValue[] = [
      { corners: [[0, 0, 0.4], [0.2, 0, 0.4], [0.2, 0.3, 0.5]], role: GLASS },
      { corners: [[0, 0, 0.4], [0.2, 0.3, 0.5], [0, 0.3, 0.5]], role: GLASS },
    ];
    const thick: TestTriangleValue[] = [
      { corners: [[0, 0, 0.4], [0.2, 0, 0.5], [0.2, 0.3, 0.5]], role: GLASS },
      { corners: [[0, 0, 0.4], [0.2, 0.3, 0.5], [0, 0.3, 0.4]], role: GLASS },
    ];
    const corner: TestTriangleValue[] = [
      { corners: [[0, 0, 0.4], [0.2, 0, 0.4], [0.2, 0.2, 0.4]], role: GLASS },
    ];

    expect(listWorldModelWindows(createTrianglesWorldModel(lying))).toEqual([]);
    expect(listWorldModelWindows(createTrianglesWorldModel(leaning))).toEqual([]);
    expect(listWorldModelWindows(createTrianglesWorldModel(thick))).toEqual([]);
    expect(listWorldModelWindows(createTrianglesWorldModel(corner))).toEqual([]);
  });

  it('keeps the result for the same data object', () => {
    const data = createTrianglesWorldModel(createQuad(FRONT));

    expect(listWorldModelWindows(data)).toBe(listWorldModelWindows(data));
    expect(listWorldModelWindows(createTrianglesWorldModel(createQuad(FRONT)))).not.toBe(listWorldModelWindows(data));
  });
});
