import type { ReactElement } from 'react';
import type {
  BoxGeometry,
  Group,
} from 'three';

import { useRef } from 'react';

import type { WarehouseGeometryKitValue } from './createWarehouseGeometryKit';
import type { WarehouseYardTrafficValue } from './WarehouseCargo';
import type { WarehouseDockCargoValue } from './warehouseDockCargo';
import type { WarehouseForkliftRigValue } from './WarehouseForklift';
import type {
  WarehouseDockPointValue,
  WarehouseLayoutValue,
} from './warehouseLayout';
import type { WarehouseYardParkingRigValue } from './WarehouseYardParkingLayer';

import { WarehouseCargo } from './WarehouseCargo';
import { WarehouseForklift } from './WarehouseForklift';
import { WarehouseInstances } from './WarehouseInstances';
import { WarehouseYardParking } from './WarehouseYardParkingLayer';

interface WarehouseDockLaneProps {
  dock: undefined | WarehouseDockPointValue;
  geometry: BoxGeometry;
  hasAssignedDocks: boolean;
  hasShadows: boolean;
  kit: WarehouseGeometryKitValue;
  lane: WarehouseDockCargoValue;
  laneIndex: number;
  layout: WarehouseLayoutValue;
  traffic: WarehouseYardTrafficValue;
}

const EMPTY_CARGO = { dockTaskId: undefined, hasDock: false, units: [] };

export const WarehouseDockLane = ({
  dock, geometry, hasAssignedDocks, hasShadows, kit, lane, laneIndex, layout, traffic,
}: WarehouseDockLaneProps): ReactElement => {
  const dockTruck = useRef<Group>(null);
  const forklift = useRef<WarehouseForkliftRigValue>(null);
  const yardParking = useRef<WarehouseYardParkingRigValue>(null);
  const { balances, cargo } = lane;
  const hasDock = cargo?.hasDock === true && dock !== undefined;
  const hasParking = hasDock && laneIndex === 0;

  return (
    <>
      {hasDock && (
        <group name="warehouse-dock-truck" ref={dockTruck} visible={false}>
          {[...layout.truck].map(([key, boxes]) => (
            <WarehouseInstances boxes={boxes} geometry={geometry} key={key} materialKey={key} />
          ))}
        </group>
      )}
      <WarehouseForklift rig={forklift} />
      {hasParking && <WarehouseYardParking geometry={geometry} rig={yardParking} trucks={layout.truck} />}
      <WarehouseCargo
        balances={balances}
        cargo={cargo ?? EMPTY_CARGO}
        dock={dock}
        dockTruck={dockTruck}
        forklift={forklift}
        geometry={geometry}
        hasAssignedDocks={hasAssignedDocks}
        hasShadows={hasShadows}
        key={cargo === undefined ? 'stock' : 'receiving'}
        kit={kit}
        laneIndex={laneIndex}
        layout={layout}
        traffic={traffic}
        yardParking={yardParking}
      />
    </>
  );
};
