import {
  GLB_BIN_CHUNK,
  GLB_COMPONENT_FLOAT,
  GLB_COMPONENT_UNSIGNED_BYTE,
  GLB_COMPONENT_UNSIGNED_INT,
  GLB_COMPONENT_UNSIGNED_SHORT,
  GLB_JSON_CHUNK,
  GLB_MAGIC,
  GLB_VERSION,
} from './parseGlb.ts';

export interface AssembleOptionsValue {
  hasBin?: boolean;
  hasJson?: boolean;
  isTruncated?: boolean;
  magic?: number;
  version?: number;
}

export interface FixtureAccessorValue {
  bufferView: number;
  byteOffset?: number;
  componentType: number;
  count: number;
  sparse?: object;
  type: string;
}

export type FixtureIndexKindValue = 'u8' | 'u16' | 'u32';

export interface FixtureJsonValue {
  accessors: FixtureAccessorValue[];
  bufferViews: { buffer: number; byteLength: number; byteOffset: number; byteStride?: number }[];
  extensionsRequired?: string[];
  meshes: { primitives: { attributes: Record<string, number>; indices?: number; mode?: number }[] }[];
  nodes: { children?: number[]; mesh?: number; scale?: number[]; translation?: number[] }[];
  scene: number;
  scenes: { nodes: number[] }[];
}

export interface FixtureOptionsValue {
  hasSecondPrimitive?: boolean;
  indexKind?: FixtureIndexKindValue;
  isInterleaved?: boolean;
}

export interface FixturePartsValue {
  bin: Uint8Array;
  json: FixtureJsonValue;
}

export const FIXTURE_POSITIONS: readonly number[] = [0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0];

export const FIXTURE_NORMALS: readonly number[] = [0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1];

export const FIXTURE_UVS: readonly number[] = [0.125, 0.125, 0.25, 0.125, 0.25, 0.25, 0.125, 0.25];

export const FIXTURE_FIRST_INDICES: readonly number[] = [0, 1, 2, 0, 2, 3];

export const FIXTURE_SECOND_INDICES: readonly number[] = [0, 1, 3];

const INDEX_COMPONENTS: Readonly<Record<FixtureIndexKindValue, { bytes: number; componentType: number }>> = {
  u8: { bytes: 1, componentType: GLB_COMPONENT_UNSIGNED_BYTE },
  u16: { bytes: 2, componentType: GLB_COMPONENT_UNSIGNED_SHORT },
  u32: { bytes: 4, componentType: GLB_COMPONENT_UNSIGNED_INT },
};

const ALIGNMENT_BYTES = 4;

const VERTEX_COUNT = 4;

const alignUp = (offset: number): number => Math.ceil(offset / ALIGNMENT_BYTES) * ALIGNMENT_BYTES;

const writeIndices = (view: DataView, offset: number, indices: readonly number[], kind: FixtureIndexKindValue): void => {
  const { bytes } = INDEX_COMPONENTS[kind];

  for (const [position, index] of indices.entries()) {
    if (kind === 'u8') {
      view.setUint8(offset + position * bytes, index);
    }
    else if (kind === 'u16') {
      view.setUint16(offset + position * bytes, index, true);
    }
    else {
      view.setUint32(offset + position * bytes, index, true);
    }
  }
};

export const createGlbParts = (options: FixtureOptionsValue = {}): FixturePartsValue => {
  const { hasSecondPrimitive = false, indexKind = 'u16', isInterleaved = false } = options;
  const { bytes: indexBytes, componentType: indexComponent } = INDEX_COMPONENTS[indexKind];
  const vertexBytes = isInterleaved ? VERTEX_COUNT * 32 : VERTEX_COUNT * (12 + 12 + 8);
  const firstIndicesOffset = alignUp(vertexBytes);
  const secondIndicesOffset = alignUp(firstIndicesOffset + FIXTURE_FIRST_INDICES.length * indexBytes);
  const totalBytes = alignUp(secondIndicesOffset + FIXTURE_SECOND_INDICES.length * indexBytes);
  const bin = new Uint8Array(totalBytes);
  const view = new DataView(bin.buffer);

  for (let vertex = 0; vertex < VERTEX_COUNT; vertex += 1) {
    const positionOffset = isInterleaved ? vertex * 32 : vertex * 12;
    const normalOffset = isInterleaved ? vertex * 32 + 12 : VERTEX_COUNT * 12 + vertex * 12;
    const uvOffset = isInterleaved ? vertex * 32 + 24 : VERTEX_COUNT * 24 + vertex * 8;

    for (let axis = 0; axis < 3; axis += 1) {
      view.setFloat32(positionOffset + axis * 4, FIXTURE_POSITIONS[vertex * 3 + axis] ?? 0, true);
      view.setFloat32(normalOffset + axis * 4, FIXTURE_NORMALS[vertex * 3 + axis] ?? 0, true);
    }

    view.setFloat32(uvOffset, FIXTURE_UVS[vertex * 2] ?? 0, true);
    view.setFloat32(uvOffset + 4, FIXTURE_UVS[vertex * 2 + 1] ?? 0, true);
  }

  writeIndices(view, firstIndicesOffset, FIXTURE_FIRST_INDICES, indexKind);
  writeIndices(view, secondIndicesOffset, FIXTURE_SECOND_INDICES, indexKind);

  const attributeViews: FixtureJsonValue['bufferViews'] = isInterleaved
    ? [{ buffer: 0, byteLength: vertexBytes, byteOffset: 0, byteStride: 32 }]
    : [
        { buffer: 0, byteLength: VERTEX_COUNT * 12, byteOffset: 0 },
        { buffer: 0, byteLength: VERTEX_COUNT * 12, byteOffset: VERTEX_COUNT * 12 },
        { buffer: 0, byteLength: VERTEX_COUNT * 8, byteOffset: VERTEX_COUNT * 24 },
      ];
  const attributeAccessors: FixtureAccessorValue[] = isInterleaved
    ? [
        { bufferView: 0, byteOffset: 0, componentType: GLB_COMPONENT_FLOAT, count: VERTEX_COUNT, type: 'VEC3' },
        { bufferView: 0, byteOffset: 12, componentType: GLB_COMPONENT_FLOAT, count: VERTEX_COUNT, type: 'VEC3' },
        { bufferView: 0, byteOffset: 24, componentType: GLB_COMPONENT_FLOAT, count: VERTEX_COUNT, type: 'VEC2' },
      ]
    : [
        { bufferView: 0, componentType: GLB_COMPONENT_FLOAT, count: VERTEX_COUNT, type: 'VEC3' },
        { bufferView: 1, componentType: GLB_COMPONENT_FLOAT, count: VERTEX_COUNT, type: 'VEC3' },
        { bufferView: 2, componentType: GLB_COMPONENT_FLOAT, count: VERTEX_COUNT, type: 'VEC2' },
      ];
  const indexViewStart = attributeViews.length;
  const bufferViews: FixtureJsonValue['bufferViews'] = [
    ...attributeViews,
    { buffer: 0, byteLength: FIXTURE_FIRST_INDICES.length * indexBytes, byteOffset: firstIndicesOffset },
    { buffer: 0, byteLength: FIXTURE_SECOND_INDICES.length * indexBytes, byteOffset: secondIndicesOffset },
  ];
  const accessors: FixtureAccessorValue[] = [
    ...attributeAccessors,
    { bufferView: indexViewStart, componentType: indexComponent, count: FIXTURE_FIRST_INDICES.length, type: 'SCALAR' },
    { bufferView: indexViewStart + 1, componentType: indexComponent, count: FIXTURE_SECOND_INDICES.length, type: 'SCALAR' },
  ];
  const attributes = { NORMAL: 1, POSITION: 0, TEXCOORD_0: 2 };
  const primitives = [
    { attributes, indices: 3 },
    ...(hasSecondPrimitive ? [{ attributes, indices: 4 }] : []),
  ];

  return {
    bin,
    json: {
      accessors,
      bufferViews,
      meshes: [{ primitives }],
      nodes: [{ mesh: 0 }],
      scene: 0,
      scenes: [{ nodes: [0] }],
    },
  };
};

const createChunk = (type: number, payload: Uint8Array, padding: number): Uint8Array => {
  const paddedLength = alignUp(payload.length);
  const chunk = new Uint8Array(8 + paddedLength);
  const view = new DataView(chunk.buffer);

  view.setUint32(0, paddedLength, true);
  view.setUint32(4, type, true);
  chunk.fill(padding, 8);
  chunk.set(payload, 8);

  return chunk;
};

export const assembleGlb = (
  { bin, json }: FixturePartsValue,
  { hasBin = true, hasJson = true, isTruncated = false, magic = GLB_MAGIC, version = GLB_VERSION }: AssembleOptionsValue = {},
): Uint8Array => {
  const chunks = [
    ...(hasJson ? [createChunk(GLB_JSON_CHUNK, new TextEncoder().encode(JSON.stringify(json)), 0x20)] : []),
    ...(hasBin ? [createChunk(GLB_BIN_CHUNK, bin, 0)] : []),
  ];
  const totalLength = 12 + chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const file = new Uint8Array(totalLength);
  const view = new DataView(file.buffer);
  let offset = 12;

  view.setUint32(0, magic, true);
  view.setUint32(4, version, true);
  view.setUint32(8, totalLength, true);

  for (const chunk of chunks) {
    file.set(chunk, offset);
    offset += chunk.length;
  }

  return isTruncated ? file.subarray(0, totalLength - 16) : file;
};
