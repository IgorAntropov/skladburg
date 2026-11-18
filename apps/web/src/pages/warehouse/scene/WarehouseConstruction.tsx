import type { ReactElement } from 'react';

import { useMemo } from 'react';

import type { WarehouseConstructionLayerProps } from '../model/warehouseSceneInteraction';

import { buildWarehouseConstruction } from './warehouseConstructionLayout';

const WarehouseConstruction = ({
  construction, geometry, instances: Instances, topology,
}: WarehouseConstructionLayerProps): ReactElement => {
  const { blocked, previews, zones } = useMemo(() => buildWarehouseConstruction(topology, construction), [construction, topology]);

  return (
    <>
      <Instances boxes={zones} geometry={geometry} materialKey="lampGlow" />
      <Instances boxes={previews} geometry={geometry} materialKey="lightPool" />
      <Instances boxes={blocked} geometry={geometry} materialKey="buildingBrick" />
    </>
  );
};

export default WarehouseConstruction;
