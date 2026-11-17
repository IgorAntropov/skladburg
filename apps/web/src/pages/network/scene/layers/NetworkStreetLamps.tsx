import type { ReactElement } from 'react';
import type {
  BufferGeometry,
  Material,
} from 'three';

import {
  useEffect,
  useMemo,
} from 'react';

import type { QualityLevelValue } from '@/shared/3d';

import {
  QUALITY_LEVEL_SETTINGS,
  useWorldGlowMaterial,
  useWorldMaterial,
} from '@/shared/3d';

import type { WorldModelDataValue } from '../models/format/worldModelFormat';
import type { StreetLampsValue } from '../night';

import {
  INSTANCE_MATRIX_ITEM_SIZE,
  writeInstanceMatrix,
} from '../geometry/composeInstanceMatrix';
import { createWorldModelGeometry } from '../models/createWorldModelGeometry';
import { LAMP_HEAD_GLOW_SPEC } from './glowSpecs';
import { InstancedLayer } from './InstancedLayer';

interface NetworkStreetLampsProps {
  boxGeometry: BufferGeometry;
  lamps: StreetLampsValue;
  level: QualityLevelValue;
  model: undefined | WorldModelDataValue;
  modelMaterial: Material;
}

export const NetworkStreetLamps = ({ boxGeometry, lamps, level, model, modelMaterial }: NetworkStreetLampsProps): ReactElement => {
  const { decorDensity } = QUALITY_LEVEL_SETTINGS[level];
  const poleMaterial = useWorldMaterial('road');
  const headMaterial = useWorldGlowMaterial(LAMP_HEAD_GLOW_SPEC);
  const count = lamps.getVisibleCount(decorDensity);
  const geometry = useMemo(() => model === undefined ? undefined : createWorldModelGeometry(model), [model]);
  const matrices = useMemo(() => {
    const next = new Float32Array(lamps.count * INSTANCE_MATRIX_ITEM_SIZE);
    lamps.lamps.forEach(({ postX, postZ, side, yaw }, index) => {
      writeInstanceMatrix(next, index, { rotationY: yaw - side * Math.PI / 2, scale: [2.4, 3, 2.4], x: postX, y: 0, z: postZ });
    });
    return next;
  }, [lamps]);

  useEffect(() => {
    return () => {
      geometry?.dispose();
    };
  }, [geometry]);

  return (
    <>
      <InstancedLayer
        count={count}
        delays={undefined}
        geometry={geometry ?? boxGeometry}
        hasShadowCast={false}
        hasShadowReceive={false}
        material={geometry === undefined ? poleMaterial : modelMaterial}
        matrices={geometry === undefined ? lamps.poleMatrices : matrices}
        tints={undefined}
      />
      <InstancedLayer
        count={count}
        delays={lamps.delays}
        geometry={boxGeometry}
        hasShadowCast={false}
        hasShadowReceive={false}
        material={headMaterial}
        matrices={lamps.headMatrices}
        tints={undefined}
      />
    </>
  );
};
