export interface WarehouseYardDockChoiceValue {
  taskId: string;
  taskVersion: number;
  unloadingPointId: string;
}

export type WarehouseYardDragOptionsValue = ReadonlyMap<string, WarehouseYardDragVisitValue>;

export interface WarehouseYardDragValue {
  onDockDrop: (choice: WarehouseYardDockChoiceValue) => void;
  options: WarehouseYardDragOptionsValue;
}

interface WarehouseYardDragVisitValue {
  taskVersion: number;
  unloadingPointIds: readonly string[];
}

export const isWarehouseYardDockChoiceAllowed = (
  options: undefined | WarehouseYardDragOptionsValue,
  choice: WarehouseYardDockChoiceValue,
): boolean => {
  const visit = options?.get(choice.taskId);

  return visit?.taskVersion === choice.taskVersion && visit.unloadingPointIds.includes(choice.unloadingPointId);
};
