import type { Camera } from 'three';

import { Vector3 } from 'three';

import type { ScreenSizeValue } from '../geometry/projectWorldPointToScreen';
import type { NetworkSceneLayoutValue } from '../layout';
import type { PickCandidatesValue } from './pickNetworkObject';

import {
  CHIP_BODY_SIZE_METERS,
  CHIP_CENTER_HEIGHT_METERS,
  CHIP_RIM_SCALE,
  PLAZA_HEIGHT_METERS,
} from '../geometry/networkSceneMetrics';
import {
  createScreenPoint,
  projectWorldPointToScreen,
} from '../geometry/projectWorldPointToScreen';

export interface PickTargetsValue {
  cities: readonly PickTargetCityValue[];
  sites: readonly PickTargetSiteValue[];
}

interface PickTargetCityValue {
  id: string;
  radius: number;
  x: number;
  z: number;
}

interface PickTargetSiteValue {
  id: string;
  x: number;
  z: number;
}

interface ProjectionScratchValue {
  base: { x: number; y: number; z: number };
  basePoint: ReturnType<typeof createScreenPoint>;
  origin: { x: number; y: number; z: number };
  originPoint: ReturnType<typeof createScreenPoint>;
  tip: { x: number; y: number; z: number };
  tipPoint: ReturnType<typeof createScreenPoint>;
  unitRight: Vector3;
  unitRightPoint: ReturnType<typeof createScreenPoint>;
}

const CHIP_HALF_EXTENT_METERS = (CHIP_BODY_SIZE_METERS / 2) * CHIP_RIM_SCALE;

const RIGHT_COLUMN = 0;
const BACKWARD_COLUMN = 2;

const backward = new Vector3();

const scratch: ProjectionScratchValue = {
  base: { x: 0, y: PLAZA_HEIGHT_METERS, z: 0 },
  basePoint: createScreenPoint(),
  origin: { x: 0, y: 0, z: 0 },
  originPoint: createScreenPoint(),
  tip: { x: 0, y: CHIP_CENTER_HEIGHT_METERS, z: 0 },
  tipPoint: createScreenPoint(),
  unitRight: new Vector3(),
  unitRightPoint: createScreenPoint(),
};

export const buildPickTargets = (layout: NetworkSceneLayoutValue): PickTargetsValue => ({
  cities: layout.cities.map(city => ({ id: city.id, radius: city.radius, x: city.x, z: city.z })),
  sites: layout.buildings.flatMap(building => (
    building.isCompany && building.siteId !== undefined ? [{ id: building.siteId, x: building.x, z: building.z }] : []
  )),
});

export const createPickCandidates = (targets: PickTargetsValue): PickCandidatesValue => ({
  cities: targets.cities.map(city => ({ id: city.id, radiusX: 0, radiusY: 0, x: 0, y: 0 })),
  sites: targets.sites.map(site => ({ baseX: 0, baseY: 0, id: site.id, reachPx: 0, tipX: 0, tipY: 0 })),
});

export const projectPickCandidates = (
  targets: PickTargetsValue,
  camera: Camera,
  size: ScreenSizeValue,
  out: PickCandidatesValue,
): PickCandidatesValue => {
  camera.updateMatrixWorld();

  scratch.unitRight.setFromMatrixColumn(camera.matrixWorld, RIGHT_COLUMN);
  backward.setFromMatrixColumn(camera.matrixWorld, BACKWARD_COLUMN);

  projectWorldPointToScreen(scratch.origin, camera, size, scratch.originPoint);
  projectWorldPointToScreen(scratch.unitRight, camera, size, scratch.unitRightPoint);

  const pixelsPerMeter = Math.hypot(
    scratch.unitRightPoint.x - scratch.originPoint.x,
    scratch.unitRightPoint.y - scratch.originPoint.y,
  );
  const groundSquash = Math.abs(backward.y);
  const reachPx = CHIP_HALF_EXTENT_METERS * pixelsPerMeter;

  for (const [index, site] of targets.sites.entries()) {
    const candidate = out.sites[index];

    if (candidate !== undefined) {
      scratch.base.x = site.x;
      scratch.base.z = site.z;
      scratch.tip.x = site.x;
      scratch.tip.z = site.z;
      projectWorldPointToScreen(scratch.base, camera, size, scratch.basePoint);
      projectWorldPointToScreen(scratch.tip, camera, size, scratch.tipPoint);
      candidate.baseX = scratch.basePoint.x;
      candidate.baseY = scratch.basePoint.y;
      candidate.tipX = scratch.tipPoint.x;
      candidate.tipY = scratch.tipPoint.y;
      candidate.reachPx = reachPx;
    }
  }

  for (const [index, city] of targets.cities.entries()) {
    const candidate = out.cities[index];

    if (candidate !== undefined) {
      scratch.base.x = city.x;
      scratch.base.z = city.z;
      projectWorldPointToScreen(scratch.base, camera, size, scratch.basePoint);
      candidate.x = scratch.basePoint.x;
      candidate.y = scratch.basePoint.y;
      candidate.radiusX = city.radius * pixelsPerMeter;
      candidate.radiusY = city.radius * pixelsPerMeter * groundSquash;
    }
  }

  return out;
};
