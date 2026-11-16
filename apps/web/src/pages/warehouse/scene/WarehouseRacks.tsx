import type { ReactElement } from 'react';
import type { BufferGeometry } from 'three';

import { useMemo } from 'react';

import type { QualityLevelValue } from '@/shared/3d';

import { QUALITY_LEVEL_SETTINGS } from '@/shared/3d';

import type { WarehouseGeometryKitValue } from './createWarehouseGeometryKit';
import type {
  WarehouseBoxValue,
  WarehouseRackLayoutValue,
} from './warehouseLayout';

import { WarehouseInstances } from './WarehouseInstances';
import { pickWarehouseRackDetail } from './warehouseRackDetail';

interface WarehouseRacksProps {
  box: BufferGeometry;
  kit: WarehouseGeometryKitValue;
  layout: WarehouseRackLayoutValue;
  level: QualityLevelValue;
}

const buildRackPosts = (frames: WarehouseRackLayoutValue['frames']): WarehouseBoxValue[] => frames.flatMap(
  ({ position: [x, y, z], size: [width, height, depth] }): WarehouseBoxValue[] => {
    const thickness = Math.min(0.055, depth / 4);

    return [-1, 1].map(direction => ({
      position: [x, y, z + direction * (depth - thickness) / 2],
      size: [width * 0.65, height, thickness],
    }));
  },
);

export const WarehouseRacks = ({ box, kit, layout, level }: WarehouseRacksProps): ReactElement => {
  const { hasShadows } = QUALITY_LEVEL_SETTINGS[level];
  const detail = pickWarehouseRackDetail(layout, level);
  const hasPosts = detail === 'posts';
  const posts = useMemo(() => hasPosts ? buildRackPosts(layout.frames) : [], [hasPosts, layout.frames]);
  const frame = detail === 'detailed' ? kit.rackFrame : kit.rackFrameLow;
  const deck = detail === 'detailed' ? kit.rackDeck : kit.rackDeckLow;
  const rail = detail === 'detailed' ? kit.rackRail : kit.rackRailLow;

  return (
    <group name="warehouse-racks">
      <WarehouseInstances
        boxes={hasPosts ? posts : layout.frames}
        geometry={hasPosts ? box : frame}
        isShadowed={hasShadows}
        materialKey="warehouseRoof"
      />
      <WarehouseInstances boxes={layout.decks} geometry={deck} isShadowed={hasShadows} materialKey="buildingWall" />
      {!hasPosts && (
        <WarehouseInstances boxes={layout.decks} geometry={rail} isShadowed={hasShadows} materialKey="buildingRoofAlt" />
      )}
      <WarehouseInstances boxes={layout.dividers} geometry={box} materialKey="warehouseRoof" />
      {!hasPosts && <WarehouseInstances boxes={layout.guards} geometry={box} materialKey="sand" />}
    </group>
  );
};
