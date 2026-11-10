import type {
  BufferGeometry,
  Color,
} from 'three';

import {
  BoxGeometry,
  CylinderGeometry,
  Float32BufferAttribute,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

import { createBeveledBoxGeometry } from '../geometry/createBeveledBoxGeometry';
import {
  TRUCK_BOX,
  TRUCK_CAB,
} from './networkTruckDimensions';

interface NetworkTruckColorsValue {
  box: Color;
  cab: Color;
  chassis: Color;
  glass: Color;
  hub: Color;
}

const TRUCK_AXLES = [-0.88, -0.49, 0.73] as const;
const WHEEL_SIDE_X = [-0.43, 0.43] as const;
const WHEEL_HEIGHT = 0.17;
const WHEEL_SEGMENTS = 8;

const applyColor = (geometry: BufferGeometry, color: Color): BufferGeometry => {
  const count = geometry.getAttribute('position').count;
  const colors = new Float32Array(count * 3);

  for (let index = 0; index < colors.length; index += 3) {
    colors[index] = color.r;
    colors[index + 1] = color.g;
    colors[index + 2] = color.b;
  }

  geometry.deleteAttribute('uv');
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));

  return geometry;
};

const toSolid = (geometry: BufferGeometry, color: Color): BufferGeometry => {
  const solid = geometry.toNonIndexed();
  geometry.dispose();

  return applyColor(solid, color);
};

const createTruckBody = (size: typeof TRUCK_BOX, color: Color): BufferGeometry => {
  const body = createBeveledBoxGeometry({
    bottomShade: 1,
    radii: { x: 0.07, y: 0.08, z: 0.045 },
    segments: 1,
    shadeHeight: 0.15,
  });

  body.scale(size.width, size.height, size.depth);
  body.translate(0, size.y, size.z);

  return applyColor(body, color);
};

export const createNetworkTruckGeometry = (colors: NetworkTruckColorsValue): BufferGeometry => {
  const parts = [
    createTruckBody(TRUCK_BOX, colors.box),
    createTruckBody(TRUCK_CAB, colors.cab),
    toSolid(new BoxGeometry(0.72, 0.19, 2.1).translate(0, 0.18, -0.02), colors.chassis),
    toSolid(new BoxGeometry(0.7, 0.2, 0.018).translate(0, 0.66, TRUCK_CAB.z + TRUCK_CAB.depth / 2), colors.glass),
  ];

  for (const z of TRUCK_AXLES) {
    for (const x of WHEEL_SIDE_X) {
      parts.push(
        toSolid(
          new CylinderGeometry(WHEEL_HEIGHT, WHEEL_HEIGHT, 0.15, WHEEL_SEGMENTS).rotateZ(Math.PI / 2).translate(x, WHEEL_HEIGHT, z),
          colors.chassis,
        ),
        toSolid(
          new CylinderGeometry(0.084, 0.084, 0.158, WHEEL_SEGMENTS).rotateZ(Math.PI / 2).translate(x, WHEEL_HEIGHT, z),
          colors.hub,
        ),
      );
    }
  }

  const geometry = mergeGeometries(parts);

  for (const part of parts) {
    part.dispose();
  }

  return geometry;
};
