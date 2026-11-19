import type { InstancedBufferAttribute } from 'three';

export const paintWarehouseTruckMarkingCell = (
  colors: InstancedBufferAttribute,
  cells: ReadonlyMap<string, number> | undefined,
  taskId: string | undefined,
  index: number,
): void => {
  const cell = taskId === undefined ? 0 : cells?.get(taskId) ?? 0;
  if (colors.getX(index) !== cell) {
    colors.setX(index, cell);
    colors.needsUpdate = true;
  }
};
