import type { InstanceTransformValue } from '../geometry/composeInstanceMatrix';
import type { WorldModelFitValue } from '../models/fitWorldModelToFootprint';
import type {
  WorldModelFaceValue,
  WorldModelWindowValue,
} from '../models/listWorldModelWindows';

import { PLAZA_HEIGHT_METERS } from '../geometry/networkSceneMetrics';
import { WINDOW_STANDOFF_METERS } from './nightConstants';

interface ModelOriginValue {
  x: number;
  z: number;
}

const MODEL_FACE_YAWS: Readonly<Record<WorldModelFaceValue, number>> = {
  negativeX: -Math.PI / 2,
  negativeZ: Math.PI,
  positiveX: Math.PI / 2,
  positiveZ: 0,
};

export const placeModelWindow = (
  window: WorldModelWindowValue,
  fit: WorldModelFitValue,
  origin: ModelOriginValue,
): InstanceTransformValue => {
  const [scaleX, scaleY, scaleZ] = fit.scale;
  const [centerX, centerY, centerZ] = window.center;
  const isOnZWall = window.face === 'positiveZ' || window.face === 'negativeZ';
  const yaw = fit.rotationY + MODEL_FACE_YAWS[window.face];
  const sine = Math.sin(fit.rotationY);
  const cosine = Math.cos(fit.rotationY);
  const localX = centerX * scaleX;
  const localZ = centerZ * scaleZ;

  return {
    rotationY: yaw,
    scale: [window.width * (isOnZWall ? scaleX : scaleZ), window.height * scaleY, 1],
    x: origin.x + cosine * localX + sine * localZ + WINDOW_STANDOFF_METERS * Math.sin(yaw),
    y: PLAZA_HEIGHT_METERS + centerY * scaleY,
    z: origin.z - sine * localX + cosine * localZ + WINDOW_STANDOFF_METERS * Math.cos(yaw),
  };
};
