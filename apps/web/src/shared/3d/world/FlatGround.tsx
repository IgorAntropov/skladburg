import type { ReactElement } from 'react';

import type { SceneWorldValue } from './sceneWorld';

import { useWorldMaterial } from '../materials/useWorldMaterial';

interface FlatGroundProps {
  world: SceneWorldValue;
}

const GROUND_ROTATION: [number, number, number] = [-Math.PI / 2, 0, 0];

const skipRaycast = (): void => undefined;

export const FlatGround = ({ world }: FlatGroundProps): ReactElement => {
  const material = useWorldMaterial('ground');
  const { bounds } = world;

  return (
    <mesh
      material={material}
      position={[(bounds.minX + bounds.maxX) / 2, 0, (bounds.minZ + bounds.maxZ) / 2]}
      raycast={skipRaycast}
      rotation={GROUND_ROTATION}
    >
      <planeGeometry args={[bounds.maxX - bounds.minX, bounds.maxZ - bounds.minZ]} />
    </mesh>
  );
};
