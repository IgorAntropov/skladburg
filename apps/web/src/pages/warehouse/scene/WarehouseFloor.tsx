import type { ReactElement } from 'react';
import type { BufferGeometry } from 'three';

import type { WarehouseLayoutValue } from './warehouseLayout';

import { WarehouseInstances } from './WarehouseInstances';

interface WarehouseFloorProps {
  batches: WarehouseLayoutValue['floor'];
  geometry: BufferGeometry;
  hasShadows: boolean;
}

export const WarehouseFloor = ({ batches, geometry, hasShadows }: WarehouseFloorProps): ReactElement => (
  <group name="warehouse-floor">
    {[...batches].map(([key, boxes]) => {
      const hasWallShadows = hasShadows && (key === 'warehouseWall' || key === 'windowGlass');

      return (
        <WarehouseInstances
          boxes={boxes}
          geometry={geometry}
          isShadowed={hasWallShadows}
          key={key}
          materialKey={key}
        />
      );
    })}
  </group>
);
