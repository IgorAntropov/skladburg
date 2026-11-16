import type { BufferGeometry } from 'three';

import {
  CanvasTexture,
  InstancedBufferAttribute,
  LinearFilter,
  MeshBasicMaterial,
  PlaneGeometry,
  SRGBColorSpace,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

import { buildMonogramParts } from '@/entities/organization';

import type { NetworkTripActorValue } from '../../model/networkTripActor';
import type { SiteBannerColorsValue } from '../banner/siteBannerColors';

import { drawSiteBannerNear } from '../banner/drawSiteBannerAtlas';
import { siteBannerLogoLoader } from '../banner/siteBannerLogos';
import {
  SITE_BANNER_FONT_FAMILY,
  SITE_BANNER_NEAR_HEIGHT_PX,
  SITE_BANNER_NEAR_WIDTH_PX,
} from '../banner/siteBannerTemplate';
import {
  TRUCK_BOX,
  TRUCK_CAB,
} from './networkTruckDimensions';

interface NetworkTruckDecalsValue {
  dispose: () => void;
  geometry: BufferGeometry;
  material: MeshBasicMaterial;
  redraw: () => void;
}

const DECAL_OFFSET = 'aTruckDecalOffset';
const CELL_SIZE_PX = SITE_BANNER_NEAR_WIDTH_PX;
const MAX_ATLAS_SIZE_PX = 2048;
const UPPER_HALF_V = 0.5;
const UV_INSET = 1 / CELL_SIZE_PX;
const FRONT_Y = 0.38;
const SURFACE_CLEARANCE_METERS = 0.008;

const PROCEDURAL_MOUNTS = {
  front: { width: 0.57, y: FRONT_Y, z: TRUCK_CAB.z + TRUCK_CAB.depth / 2 + SURFACE_CLEARANCE_METERS },
  rear: { width: 0.57, y: FRONT_Y, z: TRUCK_BOX.z - TRUCK_BOX.depth / 2 - SURFACE_CLEARANCE_METERS },
  side: { width: 1, x: TRUCK_BOX.width / 2 + SURFACE_CLEARANCE_METERS, y: TRUCK_BOX.y + TRUCK_BOX.height / 2, z: TRUCK_BOX.z },
};

const MODEL_MOUNTS = {
  front: { width: 0.4, y: 0.302, z: 1.013 },
  rear: { width: 0.26, y: 0.396, z: -1.0615 },
  side: { width: 1, x: 0.424, y: 0.627, z: -0.194 },
};

const createDecalFace = (width: number, height: number, isBrand: boolean): PlaneGeometry => {
  const geometry = new PlaneGeometry(width, height);
  const uv = geometry.getAttribute('uv');

  for (let index = 0; index < uv.count; index += 1) {
    const u = UV_INSET + uv.getX(index) * (1 - UV_INSET * 2);
    const v = UV_INSET + uv.getY(index) * (UPPER_HALF_V - UV_INSET * 2) + (isBrand ? UPPER_HALF_V : 0);

    uv.setXY(index, u, v);
  }

  return geometry;
};

const createDecalGeometry = (columns: number, rows: number, count: number, hasModel: boolean): BufferGeometry => {
  const { front, rear, side } = hasModel ? MODEL_MOUNTS : PROCEDURAL_MOUNTS;
  const faces = [
    createDecalFace(side.width, side.width / 2, true).rotateY(Math.PI / 2).translate(side.x, side.y, side.z),
    createDecalFace(side.width, side.width / 2, true).rotateY(-Math.PI / 2).translate(-side.x, side.y, side.z),
    createDecalFace(front.width, front.width / 2, false).translate(0, front.y, front.z),
    createDecalFace(rear.width, rear.width / 2, false).rotateY(Math.PI).translate(0, rear.y, rear.z),
  ];
  const geometry = mergeGeometries(faces);
  const offsets = new Float32Array(count * 2);

  for (const face of faces) {
    face.dispose();
  }

  for (let index = 0; index < count; index += 1) {
    offsets[index * 2] = (index % columns) / columns;
    offsets[index * 2 + 1] = (rows - 1 - Math.floor(index / columns)) / rows;
  }

  geometry.setAttribute(DECAL_OFFSET, new InstancedBufferAttribute(offsets, 2));

  return geometry;
};

const drawRegistrationNumber = (context: CanvasRenderingContext2D, number: string, colors: SiteBannerColorsValue): void => {
  if (number.length === 0) {
    return;
  }

  const centerX = CELL_SIZE_PX / 2;
  const centerY = SITE_BANNER_NEAR_HEIGHT_PX * 1.5;
  const width = CELL_SIZE_PX - 18;
  const height = 58;

  context.fillStyle = colors.plate;
  context.beginPath();
  context.roundRect(centerX - width / 2, centerY - height / 2, width, height, 6);
  context.fill();
  context.strokeStyle = colors.text;
  context.lineWidth = 3;
  context.stroke();
  context.fillStyle = colors.text;
  context.font = `800 39px ${SITE_BANNER_FONT_FAMILY}`;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(number, centerX, centerY, width - 12);
};

export const createNetworkTruckDecals = (
  actors: readonly NetworkTripActorValue[],
  colors: SiteBannerColorsValue,
  hasModel: boolean,
): NetworkTruckDecalsValue | undefined => {
  const columns = Math.ceil(Math.sqrt(actors.length));
  const rows = Math.ceil(actors.length / columns);
  const tileSize = Math.min(CELL_SIZE_PX, Math.floor(MAX_ATLAS_SIZE_PX / columns));

  if (tileSize < 1) {
    return undefined;
  }

  const canvas = document.createElement('canvas');
  canvas.width = columns * tileSize;
  canvas.height = rows * tileSize;
  const context = canvas.getContext('2d');

  if (context === null) {
    return undefined;
  }

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.generateMipmaps = false;
  texture.minFilter = LinearFilter;
  const material = new MeshBasicMaterial({ alphaTest: 0.5, map: texture, toneMapped: false });
  const geometry = createDecalGeometry(columns, rows, actors.length, hasModel);
  material.onBeforeCompile = (shader): void => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\nattribute vec2 ${DECAL_OFFSET};`)
      .replace(
        '#include <uv_vertex>',
        `#include <uv_vertex>\nvMapUv = ${DECAL_OFFSET} + vMapUv / vec2(${String(columns)}.0, ${String(rows)}.0);`,
      );
  };
  material.customProgramCacheKey = (): string => `network-truck-decals-${String(columns)}-${String(rows)}`;

  const redraw = (): void => {
    context.resetTransform();
    context.clearRect(0, 0, canvas.width, canvas.height);
    const scale = tileSize / CELL_SIZE_PX;

    for (const [index, actor] of actors.entries()) {
      const x = (index % columns) * tileSize;
      const y = Math.floor(index / columns) * tileSize;
      const logoPath = actor.brandLogoPath ?? '';

      context.setTransform(scale, 0, 0, scale, x, y);
      drawSiteBannerNear(
        context,
        { height: SITE_BANNER_NEAR_HEIGHT_PX, width: CELL_SIZE_PX, x: 0, y: 0 },
        { logoPath, monogram: buildMonogramParts(actor.brandLabel), organizationId: actor.id, side: 'carrier' },
        colors,
        siteBannerLogoLoader.peek(logoPath),
      );
      drawRegistrationNumber(context, actor.registrationNumber, colors);
    }

    texture.needsUpdate = true;
  };

  const dispose = (): void => {
    geometry.dispose();
    material.dispose();
    texture.dispose();
  };

  return { dispose, geometry, material, redraw };
};
