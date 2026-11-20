import type { ReactElement } from 'react';
import type { BufferGeometry } from 'three';

import {
  useEffect,
  useMemo,
} from 'react';

import type { QualityLevelValue } from '@/shared/3d';

import { QUALITY_LEVEL_SETTINGS } from '@/shared/3d';

import type { WarehouseRackLayoutValue } from './warehouseLayout';

import { createWarehousePartGeometry } from './createWarehouseGeometryKit';
import { WarehouseInstances } from './WarehouseInstances';
import warehouseKit from './warehouseKit.json';
import { pickWarehouseRackDetail } from './warehouseRackDetail';
import { buildWarehouseRackPosts } from './warehouseRackGeometry';

interface WarehouseRacksProps {
  box: BufferGeometry;
  layout: WarehouseRackLayoutValue;
  level: QualityLevelValue;
}

const WarehouseRacks = ({ box, layout, level }: WarehouseRacksProps): ReactElement => {
  const { hasShadows } = QUALITY_LEVEL_SETTINGS[level];
  const detail = pickWarehouseRackDetail(layout, level);
  const hasPosts = detail === 'posts';
  const posts = useMemo(() => hasPosts ? buildWarehouseRackPosts(layout.frames) : [], [hasPosts, layout.frames]);
  const { deck, frame, rail } = useMemo(() => {
    const isDetailed = detail === 'detailed';
    return {
      deck: createWarehousePartGeometry(isDetailed ? warehouseKit.rackDeck : warehouseKit.rackDeckLow),
      frame: hasPosts ? box : createWarehousePartGeometry(isDetailed ? warehouseKit.rackFrame : warehouseKit.rackFrameLow),
      rail: hasPosts ? undefined : createWarehousePartGeometry(isDetailed ? warehouseKit.rackRail : warehouseKit.rackRailLow),
    };
  }, [box, detail, hasPosts]);
  useEffect(() => (): void => {
    deck.dispose();
    if (frame !== box) {
      frame.dispose();
    }
    rail?.dispose();
  }, [box, deck, frame, rail]);

  return (
    <group name="warehouse-racks">
      <WarehouseInstances
        boxes={hasPosts ? posts : layout.frames}
        geometry={frame}
        isShadowed={hasShadows}
        materialKey="warehouseRoof"
      />
      <WarehouseInstances boxes={layout.decks} geometry={deck} isShadowed={hasShadows} materialKey="buildingWall" />
      {rail !== undefined && (
        <WarehouseInstances boxes={layout.decks} geometry={rail} isShadowed={hasShadows} materialKey="buildingRoofAlt" />
      )}
      <WarehouseInstances boxes={layout.dividers} geometry={box} materialKey="warehouseRoof" />
      {!hasPosts && <WarehouseInstances boxes={layout.guards} geometry={box} materialKey="sand" />}
    </group>
  );
};

export default WarehouseRacks;
