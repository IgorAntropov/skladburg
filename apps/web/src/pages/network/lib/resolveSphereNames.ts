const SPHERE_NAME_COLLATOR = new Intl.Collator('ru');

export const resolveSphereNames = (
  sphereIds: readonly string[],
  sphereNameById: ReadonlyMap<string, string>,
): string[] => sphereIds
  .flatMap(sphereId => sphereNameById.get(sphereId) ?? [])
  .toSorted((current, prev) => SPHERE_NAME_COLLATOR.compare(current, prev));
