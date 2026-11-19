import type { Trip } from '@skladburg/contracts/logistics/v1/logistics';
import type { PickingTask } from '@skladburg/contracts/wms/v1/picking';
import type { ReceivingTask } from '@skladburg/contracts/wms/v1/receiving';

export interface WarehouseYardFactsInputValue {
  picking: readonly PickingTask[] | undefined;
  receiving: readonly ReceivingTask[] | undefined;
  scope: string;
  trips: readonly Trip[] | undefined;
  warehouseId: string;
}

export interface WarehouseYardFactsValue {
  knownPickupDeals: ReadonlySet<string> | undefined;
  picking: readonly PickingTask[] | undefined;
  receiving: readonly ReceivingTask[] | undefined;
  source: WarehouseYardFactsInputValue;
  trips: readonly Trip[] | undefined;
  versions: {
    picking: FactVersionsValue;
    receiving: FactVersionsValue;
    trips: FactVersionsValue;
  };
}

interface AcceptedVersionedFactsValue<T> {
  facts: readonly T[] | undefined;
  versions: FactVersionsValue;
}

type FactVersionsValue = ReadonlyMap<string, number> | undefined;

interface VersionedFactValue {
  id: string;
  version: number;
}

const acceptVersionedFacts = <T extends VersionedFactValue>(
  current: readonly T[] | undefined,
  prev: readonly T[] | undefined,
  versions: FactVersionsValue,
): AcceptedVersionedFactsValue<T> => {
  if (current === undefined) {
    return { facts: undefined, versions: undefined };
  }
  if (current === prev) {
    return { facts: current, versions };
  }

  const priorFacts = new Map(prev?.map(fact => [fact.id, fact]));
  const accepted = new Map<string, T>();
  let nextVersions: Map<string, number> | undefined;
  for (const fact of current) {
    const { id, version } = fact;
    const latest = (nextVersions ?? versions)?.get(id);
    const existing = accepted.get(id) ?? priorFacts.get(id);
    if (existing === undefined && latest !== undefined && latest >= version) {
      continue;
    }
    if (latest === undefined || latest < version) {
      nextVersions ??= new Map(versions);
      nextVersions.set(id, version);
    }
    accepted.set(id, existing !== undefined && existing.version >= version ? existing : fact);
  }

  const facts = [...accepted.values()];
  const currentVersions = nextVersions ?? versions;
  if (prev?.length === facts.length && facts.every((fact, index) => fact === prev[index])) {
    return { facts: prev, versions: currentVersions };
  }

  const isSame = facts.length === current.length && facts.every((fact, index) => fact === current[index]);
  return { facts: isSame ? current : facts, versions: currentVersions };
};

const acceptPickupDeals = (
  trips: readonly Trip[] | undefined,
  prev: ReadonlySet<string> | undefined,
  warehouseId: string,
): ReadonlySet<string> | undefined => {
  if (trips === undefined) {
    return undefined;
  }

  let next: Set<string> | undefined;
  for (const { dealId, pickup } of trips) {
    if (pickup?.warehouseId === warehouseId && prev?.has(dealId) !== true) {
      next ??= new Set(prev);
      next.add(dealId);
    }
  }
  return next ?? prev;
};

export const acceptWarehouseYardFacts = (
  previous: undefined | WarehouseYardFactsValue,
  source: WarehouseYardFactsInputValue,
): WarehouseYardFactsValue => {
  if (previous?.source === source) {
    return previous;
  }

  const prev = previous?.source.scope === source.scope ? previous : undefined;
  const picking = acceptVersionedFacts(source.picking, prev?.picking, prev?.versions.picking);
  const receiving = acceptVersionedFacts(source.receiving, prev?.receiving, prev?.versions.receiving);
  const trips = acceptVersionedFacts(source.trips, prev?.trips, prev?.versions.trips);

  return {
    knownPickupDeals: acceptPickupDeals(trips.facts, prev?.knownPickupDeals, source.warehouseId),
    picking: picking.facts,
    receiving: receiving.facts,
    source,
    trips: trips.facts,
    versions: { picking: picking.versions, receiving: receiving.versions, trips: trips.versions },
  };
};
