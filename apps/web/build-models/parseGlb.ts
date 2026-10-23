export interface GlbMeshValue {
  indices: Uint32Array;
  normals: Float32Array;
  positions: Float32Array;
  uvs: Float32Array;
  vertexCount: number;
}

interface ComponentLayoutValue {
  bytes: number;
  read: (view: DataView, offset: number) => number;
}

interface GlbAccessorValue {
  bufferView?: number;
  byteOffset?: number;
  componentType: number;
  count: number;
  sparse?: unknown;
  type: string;
}

interface GlbBufferViewValue {
  buffer: number;
  byteLength: number;
  byteOffset?: number;
  byteStride?: number;
}

interface GlbJsonValue {
  accessors?: readonly GlbAccessorValue[];
  bufferViews?: readonly GlbBufferViewValue[];
  extensionsRequired?: readonly string[];
  meshes?: readonly { primitives: readonly GlbPrimitiveValue[] }[];
  nodes?: readonly GlbNodeValue[];
  scene?: number;
  scenes?: readonly { nodes?: readonly number[] }[];
}

interface GlbNodeValue {
  children?: readonly number[];
  matrix?: readonly number[];
  mesh?: number;
  rotation?: readonly number[];
  scale?: readonly number[];
  translation?: readonly number[];
}

interface GlbPrimitiveValue {
  attributes: Readonly<Record<string, number>>;
  indices?: number;
  mode?: number;
}

export const GLB_MAGIC = 0x46546c67;

export const GLB_VERSION = 2;

export const GLB_JSON_CHUNK = 0x4e4f534a;

export const GLB_BIN_CHUNK = 0x004e4942;

export const GLB_COMPONENT_UNSIGNED_BYTE = 5121;

export const GLB_COMPONENT_UNSIGNED_SHORT = 5123;

export const GLB_COMPONENT_UNSIGNED_INT = 5125;

export const GLB_COMPONENT_FLOAT = 5126;

const GLB_HEADER_BYTES = 12;

const GLB_CHUNK_HEADER_BYTES = 8;

const TRIANGLES_MODE = 4;

const TRIANGLE_CORNERS = 3;

const IDENTITY_MATRIX: readonly number[] = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

const IDENTITY_ROTATION: readonly number[] = [0, 0, 0, 1];

const ZERO_TRANSLATION: readonly number[] = [0, 0, 0];

const UNIT_SCALE: readonly number[] = [1, 1, 1];

const INDEX_LAYOUTS: Readonly<Record<number, ComponentLayoutValue>> = {
  [GLB_COMPONENT_UNSIGNED_BYTE]: { bytes: 1, read: (view, offset) => view.getUint8(offset) },
  [GLB_COMPONENT_UNSIGNED_INT]: { bytes: 4, read: (view, offset) => view.getUint32(offset, true) },
  [GLB_COMPONENT_UNSIGNED_SHORT]: { bytes: 2, read: (view, offset) => view.getUint16(offset, true) },
};

const FLOAT_LAYOUT: ComponentLayoutValue = { bytes: 4, read: (view, offset) => view.getFloat32(offset, true) };

const ELEMENT_SIZES: Readonly<Record<string, number>> = { SCALAR: 1, VEC2: 2, VEC3: 3 };

const createError = (reason: string): Error => new Error(`GLB: ${reason}`);

const isSameVector = (current: readonly number[] | undefined, expected: readonly number[]): boolean => (
  current === undefined || (current.length === expected.length && current.every((value, index) => value === expected[index]))
);

const hasNodeTransform = (node: GlbNodeValue): boolean => !(
  isSameVector(node.matrix, IDENTITY_MATRIX)
  && isSameVector(node.rotation, IDENTITY_ROTATION)
  && isSameVector(node.scale, UNIT_SCALE)
  && isSameVector(node.translation, ZERO_TRANSLATION)
);

const parseJson = (chunk: Uint8Array): GlbJsonValue => {
  const parsed: unknown = JSON.parse(new TextDecoder().decode(chunk));

  if (typeof parsed !== 'object' || parsed === null) {
    throw createError('JSON chunk is not an object');
  }

  return parsed;
};

const appendAll = (target: number[], source: readonly number[]): void => {
  for (const value of source) {
    target.push(value);
  }
};

const readChunks = (bytes: Uint8Array): { bin: Uint8Array; json: GlbJsonValue } => {
  if (bytes.length < GLB_HEADER_BYTES) {
    throw createError('file is shorter than the header');
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  if (view.getUint32(0, true) !== GLB_MAGIC) {
    throw createError('not a GLB file');
  }

  const version = view.getUint32(4, true);

  if (version !== GLB_VERSION) {
    throw createError(`unsupported version ${String(version)}`);
  }

  const totalLength = view.getUint32(8, true);

  if (totalLength > bytes.length) {
    throw createError('file is truncated');
  }

  let json: GlbJsonValue | undefined;
  let bin: Uint8Array | undefined;
  let offset = GLB_HEADER_BYTES;

  while (offset + GLB_CHUNK_HEADER_BYTES <= totalLength) {
    const chunkLength = view.getUint32(offset, true);
    const chunkType = view.getUint32(offset + 4, true);
    const start = offset + GLB_CHUNK_HEADER_BYTES;
    const end = start + chunkLength;

    if (end > totalLength) {
      throw createError('chunk is truncated');
    }

    if (chunkType === GLB_JSON_CHUNK && json === undefined) {
      json = parseJson(bytes.subarray(start, end));
    }

    if (chunkType === GLB_BIN_CHUNK && bin === undefined) {
      bin = bytes.subarray(start, end);
    }

    offset = end;
  }

  if (json === undefined) {
    throw createError('JSON chunk is missing');
  }

  if (bin === undefined) {
    throw createError('BIN chunk is missing');
  }

  return { bin, json };
};

const readAccessor = (
  json: GlbJsonValue,
  bin: Uint8Array,
  accessorIndex: number,
  expected: { components: readonly number[]; type: string },
  name: string,
): number[] => {
  const accessor = json.accessors?.[accessorIndex];

  if (accessor === undefined) {
    throw createError(`${name} accessor ${String(accessorIndex)} does not exist`);
  }

  if (accessor.sparse !== undefined) {
    throw createError(`${name} accessor is sparse`);
  }

  if (accessor.type !== expected.type) {
    throw createError(`${name} accessor type is ${accessor.type}, expected ${expected.type}`);
  }

  if (!expected.components.includes(accessor.componentType)) {
    throw createError(`${name} component type ${String(accessor.componentType)} is not supported`);
  }

  const layout = accessor.componentType === GLB_COMPONENT_FLOAT ? FLOAT_LAYOUT : INDEX_LAYOUTS[accessor.componentType];
  const bufferView = accessor.bufferView === undefined ? undefined : json.bufferViews?.[accessor.bufferView];

  if (layout === undefined || bufferView?.buffer !== 0) {
    throw createError(`${name} accessor has no data`);
  }

  const elementSize = ELEMENT_SIZES[accessor.type] ?? 1;
  const elementBytes = layout.bytes * elementSize;
  const stride = bufferView.byteStride ?? elementBytes;
  const base = (bufferView.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
  const lastEnd = base + (accessor.count - 1) * stride + elementBytes;

  const viewEnd = (bufferView.byteOffset ?? 0) + bufferView.byteLength;

  if (accessor.count > 0 && (stride < elementBytes || lastEnd > bin.length || lastEnd > viewEnd)) {
    throw createError(`${name} accessor is out of the buffer`);
  }

  const view = new DataView(bin.buffer, bin.byteOffset, bin.byteLength);
  const values: number[] = [];

  for (let element = 0; element < accessor.count; element += 1) {
    for (let component = 0; component < elementSize; component += 1) {
      values.push(layout.read(view, base + element * stride + component * layout.bytes));
    }
  }

  return values;
};

const collectMeshIndexes = (json: GlbJsonValue): number[] => {
  const sceneIndex = json.scene ?? 0;
  const rootNodes = json.scenes?.[sceneIndex]?.nodes;

  if (rootNodes === undefined) {
    throw createError('scene has no nodes');
  }

  const meshIndexes: number[] = [];
  const pending = [...rootNodes];
  const visited = new Set<number>();

  for (const nodeIndex of pending) {
    const node = json.nodes?.[nodeIndex];

    if (node === undefined || visited.has(nodeIndex)) {
      throw createError(`node ${String(nodeIndex)} is missing or repeated`);
    }

    visited.add(nodeIndex);

    if (hasNodeTransform(node)) {
      throw createError(`node ${String(nodeIndex)} has a transform`);
    }

    if (node.mesh !== undefined) {
      meshIndexes.push(node.mesh);
    }

    pending.push(...(node.children ?? []));
  }

  return meshIndexes;
};

export const parseGlb = (bytes: Uint8Array): GlbMeshValue => {
  const { bin, json } = readChunks(bytes);

  if ((json.extensionsRequired ?? []).length > 0) {
    throw createError(`required extensions are not supported: ${(json.extensionsRequired ?? []).join(', ')}`);
  }

  const vertexBlocks = new Map<string, { count: number; offset: number }>();
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (const meshIndex of collectMeshIndexes(json)) {
    const mesh = json.meshes?.[meshIndex];

    if (mesh === undefined) {
      throw createError(`mesh ${String(meshIndex)} does not exist`);
    }

    for (const primitive of mesh.primitives) {
      if ((primitive.mode ?? TRIANGLES_MODE) !== TRIANGLES_MODE) {
        throw createError(`primitive mode ${String(primitive.mode)} is not triangles`);
      }

      const positionIndex = primitive.attributes.POSITION;
      const normalIndex = primitive.attributes.NORMAL;
      const uvIndex = primitive.attributes.TEXCOORD_0;

      if (positionIndex === undefined || normalIndex === undefined || uvIndex === undefined) {
        throw createError('primitive needs POSITION, NORMAL and TEXCOORD_0');
      }

      if (primitive.indices === undefined) {
        throw createError('primitive has no indices');
      }

      const vertexKey = `${String(positionIndex)}/${String(normalIndex)}/${String(uvIndex)}`;
      let vertexBlock = vertexBlocks.get(vertexKey);

      if (vertexBlock === undefined) {
        const primitivePositions = readAccessor(json, bin, positionIndex, { components: [GLB_COMPONENT_FLOAT], type: 'VEC3' }, 'POSITION');
        const primitiveNormals = readAccessor(json, bin, normalIndex, { components: [GLB_COMPONENT_FLOAT], type: 'VEC3' }, 'NORMAL');
        const primitiveUvs = readAccessor(json, bin, uvIndex, { components: [GLB_COMPONENT_FLOAT], type: 'VEC2' }, 'TEXCOORD_0');

        if (primitiveNormals.length !== primitivePositions.length || primitiveUvs.length / 2 !== primitivePositions.length / 3) {
          throw createError('attribute counts differ');
        }

        vertexBlock = { count: primitivePositions.length / 3, offset: positions.length / 3 };
        vertexBlocks.set(vertexKey, vertexBlock);
        appendAll(positions, primitivePositions);
        appendAll(normals, primitiveNormals);
        appendAll(uvs, primitiveUvs);
      }
      const primitiveIndices = readAccessor(
        json,
        bin,
        primitive.indices,
        { components: [GLB_COMPONENT_UNSIGNED_BYTE, GLB_COMPONENT_UNSIGNED_SHORT, GLB_COMPONENT_UNSIGNED_INT], type: 'SCALAR' },
        'indices',
      );

      if (primitiveIndices.length % TRIANGLE_CORNERS !== 0) {
        throw createError('index count is not a multiple of 3');
      }

      for (const index of primitiveIndices) {
        if (index >= vertexBlock.count) {
          throw createError(`index ${String(index)} is out of range`);
        }

        indices.push(vertexBlock.offset + index);
      }
    }
  }

  if (indices.length === 0) {
    throw createError('no triangles');
  }

  return {
    indices: Uint32Array.from(indices),
    normals: Float32Array.from(normals),
    positions: Float32Array.from(positions),
    uvs: Float32Array.from(uvs),
    vertexCount: positions.length / 3,
  };
};
