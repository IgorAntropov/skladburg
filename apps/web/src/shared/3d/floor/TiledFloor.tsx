import type { ReactElement } from 'react';

import { useThree } from '@react-three/fiber';
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  BoxGeometry,
  InstancedMesh,
  Matrix4,
} from 'three';

import type { SceneBoundsValue } from '../world/sceneBounds';

import { useWorldMaterial } from '../materials/useWorldMaterial';
import { getBoardLayout } from './getBoardLayout';
import {
  getTileCenter,
  getTileGrid,
} from './getTileGrid';

const TILE_GAP_METERS = 0.08;
const TILE_HEIGHT_METERS = 0.12;

const tileMatrix = new Matrix4();

interface TiledFloorProps {
  bounds: SceneBoundsValue;
}

export const TiledFloor = ({ bounds }: TiledFloorProps): ReactElement => {
  const invalidate = useThree(state => state.invalidate);
  const tilesRef = useRef<InstancedMesh>(null);

  const tileMaterial = useWorldMaterial('tile');
  const boardMaterial = useWorldMaterial('board');
  const edgeMaterial = useWorldMaterial('boardEdge');
  const seamMaterial = useWorldMaterial('tileSeam');

  const [boxGeometry] = useState(() => new BoxGeometry(1, 1, 1));
  const grid = useMemo(() => getTileGrid(bounds), [bounds]);

  const layout = useMemo(() => getBoardLayout(bounds), [bounds]);
  const tileWidth = Math.max(grid.pitchX - TILE_GAP_METERS, 0);
  const tileDepth = Math.max(grid.pitchZ - TILE_GAP_METERS, 0);

  useLayoutEffect(() => {
    const tiles = tilesRef.current;

    if (tiles === null) {
      return;
    }

    for (let index = 0; index < grid.count; index += 1) {
      const center = getTileCenter(grid, index);
      tileMatrix.makeScale(tileWidth, TILE_HEIGHT_METERS, tileDepth).setPosition(center.x, TILE_HEIGHT_METERS / 2, center.z);
      tiles.setMatrixAt(index, tileMatrix);
    }

    tiles.instanceMatrix.needsUpdate = true;
    invalidate();
  }, [grid, invalidate, tileDepth, tileWidth]);

  useEffect(() => {
    return () => {
      boxGeometry.dispose();
    };
  }, [boxGeometry]);

  return (
    <group>
      <instancedMesh
        args={[boxGeometry, tileMaterial, grid.count]}
        frustumCulled={false}
        key={grid.count}
        ref={tilesRef}
      />
      <mesh
        geometry={boxGeometry}
        material={seamMaterial}
        position={layout.seam.position}
        scale={layout.seam.scale}
      />
      <mesh
        geometry={boxGeometry}
        material={boardMaterial}
        position={layout.body.position}
        scale={layout.body.scale}
      />
      <mesh
        geometry={boxGeometry}
        material={edgeMaterial}
        position={layout.rim.position}
        scale={layout.rim.scale}
      />
    </group>
  );
};
