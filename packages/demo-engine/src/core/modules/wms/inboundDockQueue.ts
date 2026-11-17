export interface InboundCargoRequirementsValue {
  hasColdCargo: boolean;
  hasOversizeCargo: boolean;
}

export interface InboundDockValue {
  canHandleOversize: boolean;
  hasColdZone: boolean;
  id: string;
}

export const canUseInboundDock = (dock: InboundDockValue, cargo: InboundCargoRequirementsValue): boolean =>
  (!cargo.hasColdCargo || dock.hasColdZone) && (!cargo.hasOversizeCargo || dock.canHandleOversize);

const countSpecialties = (dock: InboundDockValue): number => Number(dock.hasColdZone) + Number(dock.canHandleOversize);

export const matchInboundDockQueue = <T extends InboundCargoRequirementsValue>(
  docks: readonly InboundDockValue[],
  queue: readonly T[],
): ReadonlyMap<string, T> => {
  const assignments = new Map<string, T>();
  const ordered = docks.toSorted((current, prev) => countSpecialties(current) - countSpecialties(prev));

  const assign = (candidate: T, visited: Set<string>): boolean => {
    const compatible = ordered.filter(dock => !visited.has(dock.id) && canUseInboundDock(dock, candidate));
    const free = compatible.find(dock => !assignments.has(dock.id));
    if (free !== undefined) {
      assignments.set(free.id, candidate);
      return true;
    }

    for (const { id } of compatible) {
      if (visited.has(id)) {
        continue;
      }
      visited.add(id);
      const previous = assignments.get(id);
      if (previous !== undefined && assign(previous, visited)) {
        assignments.set(id, candidate);
        return true;
      }
    }
    return false;
  };

  for (const candidate of queue) {
    assign(candidate, new Set());
  }
  return assignments;
};
