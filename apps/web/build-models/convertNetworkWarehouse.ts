import {
  BoxGeometry,
  PlaneGeometry,
} from 'three';

import type { WorldModelRoleValue } from '../src/pages/network/scene/models/format/worldModelFormat.ts';
import type { IndustrialMeshValue } from './convertIndustrialYard.ts';
import type { ConvertedModelValue } from './convertModel.ts';

import warehouseShell from '../src/pages/warehouse/scene/warehouseShell.json' with { type: 'json' };
import {
  addIndustrialPart,
  prepareIndustrialModel,
} from './convertIndustrialYard.ts';
import { encodeWorldModelWithReport } from './convertModel.ts';

type VectorValue = readonly [number, number, number];

const METERS_PER_MILLIMETER = 0.001;

export const convertNetworkWarehouse = (): ConvertedModelValue => {
  const model: IndustrialMeshValue = { indices: [], normals: [], positions: [], styles: [] };
  const box = new BoxGeometry();
  const plane = new PlaneGeometry();
  const addBox = (position: VectorValue, size: VectorValue, role: WorldModelRoleValue, shade = 1, pitch = 0): void => {
    addIndustrialPart(model, box, { pitch, position, size }, role, shade);
  };

  addBox([0, 0.04, 0], [1.26, 0.08, 0.87], 'mid', 0.88);
  addBox([0, 0.243, 0], [1.23, 0.466, 0.84], 'light');
  addBox([0, 0.478, 0], [1.3, 0.035, 0.91], 'mid', 0.8);

  for (const side of [-1, 1]) {
    addBox([0, 0.526, side * 0.212], [1.28, 0.02, 0.431], 'mid', side > 0 ? 1.07 : 0.97, side * 0.145);
    addBox([0, 0.23, side * 0.424], [1.225, 0.029, 0.018], 'mid', 0.96);

    for (const [x = 0, y = 0, , width = 0, height = 0, depth = 0] of warehouseShell.wall.warehouseWall.slice(1)) {
      addBox(
        [x * METERS_PER_MILLIMETER * 0.32, (y * 0.38 + 33) * METERS_PER_MILLIMETER, side * 0.42],
        [width * METERS_PER_MILLIMETER * 0.44, height * METERS_PER_MILLIMETER * 0.38, depth * METERS_PER_MILLIMETER * 0.09],
        'light',
        0.86,
      );
    }

    for (const x of [-0.39, -0.13, 0.13, 0.39]) {
      addIndustrialPart(model, plane, {
        position: [x, 0.354, side * 0.431], size: [0.169, 0.075, 1], yaw: side > 0 ? 0 : Math.PI,
      }, 'glass');
    }
  }

  addBox([0, 0.564, 0], [0.95, 0.046, 0.148], 'dark', 0.93);
  addBox([0, 0.593, 0], [1.03, 0.023, 0.184], 'mid', 1.07);
  addBox([0.618, 0.112, 0], [0.012, 0.203, 0.149], 'dark');
  for (const z of [-0.133, 0.133]) {
    addIndustrialPart(model, plane, { position: [0.619, 0.354, z], size: [0.168, 0.075, 1], yaw: Math.PI / 2 }, 'glass');
  }

  addBox([-0.624, 0.193, 0], [0.014, 0.282, 0.574], 'dark', 1.17);
  for (const y of [0.114, 0.178, 0.242, 0.306]) {
    addBox([-0.633, y, 0], [0.006, 0.008, 0.574], 'mid', 0.87);
  }

  const shelter = [
    [warehouseShell.dock.warehouseWall, 'light'],
    [warehouseShell.dock.windowGlass, 'dark'],
    [warehouseShell.dock.buildingRoofAlt.slice(0, 2), 'yellow'],
  ] as const;
  for (const [batch, role] of shelter) {
    for (const [x = 0, y = 0, z = 0, width = 0, height = 0, depth = 0] of batch) {
      addBox(
        [-0.615 + z * METERS_PER_MILLIMETER * 0.052, y * METERS_PER_MILLIMETER * 0.162, x * METERS_PER_MILLIMETER * 0.29],
        [depth * METERS_PER_MILLIMETER * 0.052, height * METERS_PER_MILLIMETER * 0.162, width * METERS_PER_MILLIMETER * 0.29],
        role,
      );
    }
  }

  box.dispose();
  plane.dispose();
  return encodeWorldModelWithReport(prepareIndustrialModel(model));
};
