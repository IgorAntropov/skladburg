import type { Sphere } from '@skladburg/contracts/organization/v1/organization';

import { create } from '@bufbuild/protobuf';
import { SphereSchema } from '@skladburg/contracts/organization/v1/organization';
import {
  describe,
  expect,
  it,
} from 'vitest';

import { buildSphereTree } from './buildSphereTree';

const createSphere = (id: string, name: string, parentId = ''): Sphere => create(SphereSchema, { id, name, parentId });

const toIdsAndDepths = (spheres: readonly Sphere[]): readonly (readonly [string, number])[] => (
  buildSphereTree(spheres).map(option => [option.id, option.depth] as const)
);

describe('buildSphereTree', () => {
  it('returns an empty list for no spheres', () => {
    expect(buildSphereTree([])).toEqual([]);
  });

  it('lists a root followed by its branches and then the next root', () => {
    const spheres = [
      createSphere('c', 'Стройматериалы'),
      createSphere('b2', 'Овощи', 'a'),
      createSphere('a', 'Продукты'),
      createSphere('b1', 'Молочная продукция', 'a'),
      createSphere('c1', 'Кирпич', 'c'),
    ];

    expect(toIdsAndDepths(spheres)).toEqual([
      ['a', 0],
      ['b1', 1],
      ['b2', 1],
      ['c', 0],
      ['c1', 1],
    ]);
  });

  it('sorts every level by name in Russian and then by id', () => {
    const spheres = [
      createSphere('z', 'Яблоки'),
      createSphere('y', 'Яблоки'),
      createSphere('x', 'Арбузы'),
      createSphere('w2', 'Бетон'),
      createSphere('w1', 'Бетон'),
    ];

    expect(buildSphereTree(spheres).map(option => option.id)).toEqual(['x', 'w1', 'w2', 'y', 'z']);
  });

  it('nests branches recursively with growing depth', () => {
    const spheres = [
      createSphere('c', 'Сыры', 'b'),
      createSphere('b', 'Молочная продукция', 'a'),
      createSphere('a', 'Продукты'),
    ];

    expect(buildSphereTree(spheres)).toEqual([
      { depth: 0, id: 'a', name: 'Продукты', parentId: '' },
      { depth: 1, id: 'b', name: 'Молочная продукция', parentId: 'a' },
      { depth: 2, id: 'c', name: 'Сыры', parentId: 'b' },
    ]);
  });

  it('treats a branch whose parent is missing from the list as a root', () => {
    const spheres = [
      createSphere('a', 'Продукты'),
      createSphere('orphan', 'Бакалея', 'missing'),
      createSphere('child', 'Крупы', 'orphan'),
    ];

    expect(toIdsAndDepths(spheres)).toEqual([
      ['orphan', 0],
      ['child', 1],
      ['a', 0],
    ]);
  });

  it('does not loop on a cycle and lists each sphere once', () => {
    const spheres = [
      createSphere('a', 'Альфа', 'b'),
      createSphere('b', 'Бета', 'a'),
      createSphere('s', 'Сам себе', 's'),
    ];

    const options = buildSphereTree(spheres);

    expect(options.map(option => option.id).toSorted()).toEqual(['a', 'b', 's']);
    expect(options).toHaveLength(3);
  });
});
