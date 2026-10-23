import {
  describe,
  expect,
  it,
} from 'vitest';

import type { FixtureJsonValue } from './glbFixtures.ts';

import {
  assembleGlb,
  createGlbParts,
  FIXTURE_FIRST_INDICES,
  FIXTURE_NORMALS,
  FIXTURE_POSITIONS,
  FIXTURE_SECOND_INDICES,
  FIXTURE_UVS,
} from './glbFixtures.ts';
import {
  GLB_COMPONENT_UNSIGNED_SHORT,
  parseGlb,
} from './parseGlb.ts';

const parseWithPatch = (patch: (json: FixtureJsonValue) => void): ReturnType<typeof parseGlb> => {
  const parts = createGlbParts();

  patch(parts.json);

  return parseGlb(assembleGlb(parts));
};

describe('parseGlb', () => {
  it('reads positions, normals, uvs and indices of a tightly packed model', () => {
    const mesh = parseGlb(assembleGlb(createGlbParts()));

    expect(mesh.vertexCount).toBe(4);
    expect([...mesh.positions]).toEqual(FIXTURE_POSITIONS);
    expect([...mesh.normals]).toEqual(FIXTURE_NORMALS);
    expect([...mesh.uvs]).toEqual(FIXTURE_UVS);
    expect([...mesh.indices]).toEqual(FIXTURE_FIRST_INDICES);
  });

  it('reads an interleaved buffer view through its byte stride', () => {
    const mesh = parseGlb(assembleGlb(createGlbParts({ isInterleaved: true })));

    expect([...mesh.positions]).toEqual(FIXTURE_POSITIONS);
    expect([...mesh.normals]).toEqual(FIXTURE_NORMALS);
    expect([...mesh.uvs]).toEqual(FIXTURE_UVS);
  });

  it.each(['u8', 'u16', 'u32'] as const)('reads %s indices', (indexKind) => {
    const mesh = parseGlb(assembleGlb(createGlbParts({ indexKind })));

    expect([...mesh.indices]).toEqual(FIXTURE_FIRST_INDICES);
  });

  it('merges primitives that share accessors without repeating vertices', () => {
    const mesh = parseGlb(assembleGlb(createGlbParts({ hasSecondPrimitive: true })));

    expect(mesh.vertexCount).toBe(4);
    expect([...mesh.indices]).toEqual([...FIXTURE_FIRST_INDICES, ...FIXTURE_SECOND_INDICES]);
  });

  it('merges primitives with their own vertices after the previous ones', () => {
    const parts = createGlbParts({ hasSecondPrimitive: true });
    const [secondAccessor] = parts.json.accessors;

    if (secondAccessor !== undefined) {
      parts.json.accessors.push({ ...secondAccessor });
      parts.json.accessors.push({ ...(parts.json.accessors[1] ?? secondAccessor) });
      parts.json.accessors.push({ ...(parts.json.accessors[2] ?? secondAccessor) });
    }

    const [firstPrimitive, secondPrimitive] = parts.json.meshes[0]?.primitives ?? [];

    if (firstPrimitive !== undefined && secondPrimitive !== undefined) {
      secondPrimitive.attributes = { NORMAL: 6, POSITION: 5, TEXCOORD_0: 7 };
    }

    const mesh = parseGlb(assembleGlb(parts));

    expect(mesh.vertexCount).toBe(8);
    expect([...mesh.indices]).toEqual([...FIXTURE_FIRST_INDICES, ...FIXTURE_SECOND_INDICES.map(index => index + 4)]);
  });

  it('walks child nodes of the scene', () => {
    const mesh = parseWithPatch((json) => {
      json.nodes = [{ children: [1] }, { mesh: 0 }];
    });

    expect(mesh.indices).toHaveLength(FIXTURE_FIRST_INDICES.length);
  });

  it('rejects a file that is not GLB', () => {
    expect(() => parseGlb(assembleGlb(createGlbParts(), { magic: 0x12345678 }))).toThrow('GLB: not a GLB file');
    expect(() => parseGlb(new Uint8Array(4))).toThrow('GLB: file is shorter than the header');
  });

  it('rejects a version other than 2', () => {
    expect(() => parseGlb(assembleGlb(createGlbParts(), { version: 1 }))).toThrow('GLB: unsupported version 1');
  });

  it('rejects a truncated file', () => {
    expect(() => parseGlb(assembleGlb(createGlbParts(), { isTruncated: true }))).toThrow('GLB: file is truncated');
  });

  it('rejects a file without the JSON chunk', () => {
    expect(() => parseGlb(assembleGlb(createGlbParts(), { hasJson: false }))).toThrow('GLB: JSON chunk is missing');
  });

  it('rejects a file without the BIN chunk', () => {
    expect(() => parseGlb(assembleGlb(createGlbParts(), { hasBin: false }))).toThrow('GLB: BIN chunk is missing');
  });

  it('rejects a sparse accessor', () => {
    expect(() => parseWithPatch((json) => {
      const [accessor] = json.accessors;

      if (accessor !== undefined) {
        accessor.sparse = {};
      }
    })).toThrow('GLB: POSITION accessor is sparse');
  });

  it('rejects required extensions', () => {
    expect(() => parseWithPatch((json) => {
      json.extensionsRequired = ['KHR_mesh_quantization'];
    })).toThrow('GLB: required extensions are not supported: KHR_mesh_quantization');
  });

  it('rejects a primitive mode other than triangles', () => {
    expect(() => parseWithPatch((json) => {
      const primitive = json.meshes[0]?.primitives[0];

      if (primitive !== undefined) {
        primitive.mode = 1;
      }
    })).toThrow('GLB: primitive mode 1 is not triangles');
  });

  it('rejects positions that are not float', () => {
    expect(() => parseWithPatch((json) => {
      const [accessor] = json.accessors;

      if (accessor !== undefined) {
        accessor.componentType = GLB_COMPONENT_UNSIGNED_SHORT;
      }
    })).toThrow('GLB: POSITION component type 5123 is not supported');
  });

  it.each([
    ['translation', { translation: [1, 0, 0] }],
    ['scale', { scale: [2, 2, 2] }],
  ])('rejects a node with a %s', (_, transform) => {
    expect(() => parseWithPatch((json) => {
      json.nodes = [{ mesh: 0, ...transform }];
    })).toThrow('GLB: node 0 has a transform');
  });

  it('accepts a node with identity transforms', () => {
    const mesh = parseWithPatch((json) => {
      json.nodes = [{ mesh: 0, scale: [1, 1, 1], translation: [0, 0, 0] }];
    });

    expect(mesh.vertexCount).toBe(4);
  });

  it('rejects a primitive without normals', () => {
    expect(() => parseWithPatch((json) => {
      const primitive = json.meshes[0]?.primitives[0];

      if (primitive !== undefined) {
        primitive.attributes = { POSITION: 0, TEXCOORD_0: 2 };
      }
    })).toThrow('GLB: primitive needs POSITION, NORMAL and TEXCOORD_0');
  });

  it('rejects a primitive without indices', () => {
    expect(() => parseWithPatch((json) => {
      const primitive = json.meshes[0]?.primitives[0];

      if (primitive !== undefined) {
        delete primitive.indices;
      }
    })).toThrow('GLB: primitive has no indices');
  });

  it('rejects an accessor that reads past the buffer', () => {
    expect(() => parseWithPatch((json) => {
      const [accessor] = json.accessors;

      if (accessor !== undefined) {
        accessor.count = 1000;
      }
    })).toThrow('GLB: POSITION accessor is out of the buffer');
  });

  it('rejects an index beyond the vertices', () => {
    const parts = createGlbParts();

    new DataView(parts.bin.buffer).setUint16(parts.json.bufferViews[3]?.byteOffset ?? 0, 9, true);

    expect(() => parseGlb(assembleGlb(parts))).toThrow('GLB: index 9 is out of range');
  });

  it('rejects an index count that is not a multiple of 3', () => {
    expect(() => parseWithPatch((json) => {
      const accessor = json.accessors[3];

      if (accessor !== undefined) {
        accessor.count = 4;
      }
    })).toThrow('GLB: index count is not a multiple of 3');
  });
});
