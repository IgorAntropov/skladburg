import type { Group } from 'three';

import { readFileSync } from 'node:fs';
import {
  Box3,
  BoxGeometry,
  BufferGeometry,
  ConeGeometry,
  CylinderGeometry,
  Euler,
  Material,
  Matrix3,
  Matrix4,
  Mesh,
  Quaternion,
  Vector3,
} from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

import type { WorldModelRoleValue } from '../src/pages/network/scene/models/format/worldModelFormat.ts';
import type { VertexStyleValue } from './createVertexStyleResolver.ts';

import { encodeWorldModelShade } from '../src/pages/network/scene/models/format/worldModelFormat.ts';
import {
  INDUSTRIAL_YARD_DEPTH,
  INDUSTRIAL_YARD_WIDTH,
} from '../src/pages/network/scene/yard/industrialYardSize.ts';
import { prepareModel } from './prepareModel.ts';
import { writeWorldModel } from './writeWorldModel.ts';

type VectorValue = readonly [number, number, number];

interface YardMeshValue {
  indices: number[];
  normals: number[];
  positions: number[];
  styles: VertexStyleValue[];
}

interface YardPartValue {
  position: VectorValue;
  size: VectorValue;
  yaw?: number;
}

const DOCK_STYLES = new Map<string, VertexStyleValue>([
  ['charcoal', { role: 'dark', shadeByte: encodeWorldModelShade(0.76) }],
  ['paint', { role: 'glass', shadeByte: encodeWorldModelShade(1) }],
  ['steel', { role: 'mid', shadeByte: encodeWorldModelShade(0.85) }],
  ['yellow', { role: 'yellow', shadeByte: encodeWorldModelShade(1) }],
]);

const UNIT = new BoxGeometry();
const STEM = new CylinderGeometry(0.5, 0.5, 1, 6);
const CROWN = new ConeGeometry(0.5, 1, 7);

const composeTransform = ({ position, size, yaw = 0 }: YardPartValue): Matrix4 => new Matrix4().compose(
  new Vector3(...position),
  new Quaternion().setFromEuler(new Euler(0, yaw, 0)),
  new Vector3(...size),
);

const addGeometry = (yard: YardMeshValue, geometry: BufferGeometry, matrix: Matrix4, style: VertexStyleValue): void => {
  const position = geometry.getAttribute('position');
  const normal = geometry.getAttribute('normal');
  const vertexOffset = yard.styles.length;
  const normalMatrix = new Matrix3().getNormalMatrix(matrix);
  const coordinates = new Vector3();
  const direction = new Vector3();

  for (let index = 0; index < position.count; index += 1) {
    coordinates.fromBufferAttribute(position, index).applyMatrix4(matrix);
    direction.fromBufferAttribute(normal, index).applyNormalMatrix(normalMatrix);
    yard.positions.push(coordinates.x, coordinates.y, coordinates.z);
    yard.normals.push(direction.x, direction.y, direction.z);
    yard.styles.push(style);
  }

  const indices = geometry.getIndex();
  const indexCount = indices?.count ?? position.count;

  for (let index = 0; index < indexCount; index += 1) {
    yard.indices.push(vertexOffset + (indices?.getX(index) ?? index));
  }
};

const addPart = (
  yard: YardMeshValue,
  geometry: BufferGeometry,
  part: YardPartValue,
  role: WorldModelRoleValue,
  shade = 1,
): void => {
  addGeometry(yard, geometry, composeTransform(part), { role, shadeByte: encodeWorldModelShade(shade) });
};

const isBufferGeometry = (geometry: unknown): geometry is BufferGeometry => geometry instanceof BufferGeometry;

const readAsset = async (loader: GLTFLoader, path: string): Promise<Group> => {
  const { scene } = await loader.parseAsync(Uint8Array.from(readFileSync(path)).buffer, '');

  return scene;
};

const addAsset = (
  yard: YardMeshValue,
  model: Group,
  part: YardPartValue,
  getStyle: (materialName: string) => undefined | VertexStyleValue,
): void => {
  model.updateMatrixWorld(true);
  const bounds = new Box3().setFromObject(model, true);
  const center = bounds.getCenter(new Vector3());
  const size = bounds.getSize(new Vector3());
  const modelTransform = composeTransform(part)
    .multiply(new Matrix4().makeScale(1 / size.x, 1 / size.y, 1 / size.z))
    .multiply(new Matrix4().makeTranslation(-center.x, -bounds.min.y, -center.z));

  model.traverse((child) => {
    if (!(child instanceof Mesh)) {
      return;
    }

    const geometry: unknown = child.geometry;
    const material: unknown = child.material;

    if (!isBufferGeometry(geometry) || !(material instanceof Material)) {
      throw new Error('Industrial yard: expected a mesh with a single material');
    }

    const style = getStyle(material.name);

    if (style === undefined) {
      throw new Error(`Industrial yard: unexpected material ${material.name}`);
    }

    addGeometry(yard, geometry, modelTransform.clone().multiply(child.matrixWorld), style);
  });
};

const addYardSurface = (yard: YardMeshValue): void => {
  addPart(yard, UNIT, { position: [0, 0.004, 0], size: [INDUSTRIAL_YARD_WIDTH, 0.008, INDUSTRIAL_YARD_DEPTH] }, 'light', 0.91);
  addPart(yard, UNIT, { position: [0, 0.008, 0], size: [1.06, 0.006, 1.43] }, 'dark', 1);
  addPart(yard, UNIT, { position: [0.49, 0.012, 0], size: [0.14, 0.004, 1.43] }, 'mid', 0.95);
  addPart(yard, UNIT, { position: [-0.415, 0.0125, -0.42], size: [0.21, 0.004, 0.58] }, 'green', 0.84);

  for (const z of [-0.41, -0.145, 0.145, 0.41]) {
    addPart(yard, UNIT, { position: [0.17, 0.0135, z], size: [0.53, 0.004, 0.017] }, 'light');
  }

  for (const z of [-0.277, 0.277]) {
    addPart(yard, UNIT, { position: [0.43, 0.016, z], size: [0.02, 0.003, 0.21] }, 'yellow');
  }

  addPart(yard, UNIT, { position: [-0.29, 0.0135, 0.08], size: [0.022, 0.004, 0.31] }, 'light');
  addPart(yard, UNIT, { position: [-0.319, 0.0135, -0.055], size: [0.024, 0.004, 0.095], yaw: -Math.PI / 4 }, 'light');
  addPart(yard, UNIT, { position: [-0.261, 0.0135, -0.055], size: [0.024, 0.004, 0.095], yaw: Math.PI / 4 }, 'light');
};

const addConifers = (yard: YardMeshValue): void => {
  const x = -0.415;

  for (const [z, height] of [[-0.62, 0.27], [-0.42, 0.35], [-0.22, 0.23]] as const) {
    addPart(yard, STEM, { position: [x, 0.079, z], size: [0.033, 0.13, 0.033] }, 'terracotta', 0.74);
    const lowerWidth = height * 0.64;
    const upperWidth = height * 0.48;

    addPart(yard, CROWN, { position: [x, 0.11 + height * 0.22, z], size: [lowerWidth, height * 0.67, lowerWidth] }, 'green', 0.76);
    addPart(yard, CROWN, { position: [x, 0.11 + height * 0.53, z], size: [upperWidth, height * 0.56, upperWidth] }, 'green', 0.92);
  }
};

export const convertIndustrialYard = async (dockPath: string, containerPath: string): Promise<Uint8Array> => {
  const loader = new GLTFLoader();
  const [dock, container] = await Promise.all([readAsset(loader, dockPath), readAsset(loader, containerPath)]);
  const yard: YardMeshValue = { indices: [], normals: [], positions: [], styles: [] };

  addYardSurface(yard);
  addConifers(yard);
  addAsset(yard, dock, { position: [0.494, 0.014, 0], size: [0.6, 0.62, 0.13], yaw: -Math.PI / 2 }, name => DOCK_STYLES.get(name));

  for (const [z, base, role, shade] of [[0.51, 0.011, 'red', 0.91], [0.53, 0.168, 'glass', 1]] as const) {
    const getStyle = (name: string): undefined | VertexStyleValue => {
      if (name === 'steel') {
        return { role, shadeByte: encodeWorldModelShade(shade * 0.8) };
      }

      return name === 'paint' || name === 'white' ? { role, shadeByte: encodeWorldModelShade(shade) } : undefined;
    };

    addAsset(yard, container, { position: [-0.38, base, z], size: [0.143, 0.157, 0.42] }, getStyle);
  }

  const prepared = prepareModel({
    indices: Uint32Array.from(yard.indices),
    normals: Float32Array.from(yard.normals),
    positions: Float32Array.from(yard.positions),
    uvs: new Float32Array(yard.styles.length * 2),
    vertexCount: yard.styles.length,
  }, (_u, _v, vertexId) => {
    const style = yard.styles[vertexId];

    if (style === undefined) {
      throw new Error('Industrial yard: missing vertex style');
    }

    return style;
  });

  return writeWorldModel(prepared);
};
