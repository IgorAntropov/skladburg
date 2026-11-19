import type {
  ReactElement,
  RefObject,
} from 'react';
import type {
  BoxGeometry,
  Group,
} from 'three';

import { useRef } from 'react';

import type { WarehouseGeometryKitValue } from './createWarehouseGeometryKit';
import type { WarehouseDockCargoValue } from './warehouseDockCargo';
import type { WarehouseYardPlaybackClockValue } from './warehouseDockPlayback';
import type { WarehouseForkliftRigValue } from './WarehouseForklift';
import type {
  WarehouseDockPointValue,
  WarehouseLayoutValue,
} from './warehouseLayout';
import type { WarehouseTruckModelValue } from './warehouseTruckModel';
import type { WarehouseYardParkingRigValue } from './WarehouseYardParkingLayer';
import type { WarehouseYardTrafficValue } from './warehouseYardTraffic';

import { WarehouseCargo } from './WarehouseCargo';
import { WarehouseForklift } from './WarehouseForklift';
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
  playbackClock: RefObject<WarehouseYardPlaybackClockValue>;
  traffic: WarehouseYardTrafficValue;
  truckModel: WarehouseTruckModelValue;
}

const EMPTY_CARGO = { dockTaskId: undefined, hasDock: false, units: [] };

export const WarehouseDockLane = ({
  dock, geometry, hasAssignedDocks, hasShadows, kit, lane, laneIndex, layout, playbackClock, traffic, truckModel,
}: WarehouseDockLaneProps): ReactElement => {
  const dockTruck = useRef<Group>(null);
  const forklift = useRef<WarehouseForkliftRigValue>(null);
  const yardParking = useRef<WarehouseYardParkingRigValue>(null);
  const { balances, cargo } = lane;
  const primaryDock = layout.receiving?.dock;
  const roads = layout.yard;
  const hasDock = cargo?.hasDock === true && dock !== undefined && primaryDock !== undefined;
  const hasParking = hasDock && laneIndex === 0;

  return (
    <>
      {hasDock && (
        <group name="warehouse-dock-truck" ref={dockTruck} visible={false}>
          <group>
            <instancedMesh
              args={[undefined, undefined, 1]}
              geometry={truckModel.geometry}
              material={truckModel.material}
              receiveShadow
              ref={mesh => truckModel.onDockTruck?.(laneIndex, mesh)}
            />
          </group>
        </group>
      )}
      <WarehouseForklift rig={forklift} />
      {hasParking && roads !== undefined && (
        <WarehouseYardParking dock={primaryDock} model={truckModel} parked={traffic.yard.parked} rig={yardParking} roads={roads} />
      )}
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
        playbackClock={playbackClock}
        traffic={traffic}
        yardParking={yardParking}
      />
    </>
  );
};
