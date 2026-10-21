import type { Group } from 'three';

import { InstancedMesh } from 'three';

export const markInstanceMatricesUpdated = (group: Group | null): void => {
  if (group === null) {
    return;
  }

  for (const child of group.children) {
    if (child instanceof InstancedMesh) {
      child.instanceMatrix.needsUpdate = true;
    }
  }
};
