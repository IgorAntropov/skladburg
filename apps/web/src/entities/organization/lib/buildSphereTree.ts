import type { Sphere } from '@skladburg/contracts/organization/v1/organization';

import { compareCodeUnits } from '@skladburg/contracts/runtime';

export interface SphereOptionValue {
  depth: number;
  id: string;
  name: string;
  parentId: string;
}

export const buildSphereTree = (spheres: readonly Sphere[]): readonly SphereOptionValue[] => {
  const collator = new Intl.Collator('ru');
  const knownIds = new Set(spheres.map(sphere => sphere.id));
  const childrenByParentId = new Map<string, Sphere[]>();

  for (const sphere of spheres) {
    const isRoot = sphere.parentId === '' || !knownIds.has(sphere.parentId);
    const groupId = isRoot ? '' : sphere.parentId;

    childrenByParentId.set(groupId, [...childrenByParentId.get(groupId) ?? [], sphere]);
  }

  const sortSpheres = (items: readonly Sphere[]): Sphere[] => items.toSorted(
    (current, prev) => collator.compare(current.name, prev.name) || compareCodeUnits(current.id, prev.id),
  );

  const options: SphereOptionValue[] = [];
  const visitedIds = new Set<string>();

  const visit = (sphere: Sphere, depth: number): void => {
    if (visitedIds.has(sphere.id)) {
      return;
    }

    visitedIds.add(sphere.id);
    options.push({ depth, id: sphere.id, name: sphere.name, parentId: sphere.parentId });

    for (const child of sortSpheres(childrenByParentId.get(sphere.id) ?? [])) {
      visit(child, depth + 1);
    }
  };

  for (const root of sortSpheres(childrenByParentId.get('') ?? [])) {
    visit(root, 0);
  }

  for (const sphere of sortSpheres(spheres)) {
    visit(sphere, 0);
  }

  return options;
};
