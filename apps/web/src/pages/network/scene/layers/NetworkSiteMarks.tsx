import type { ReactElement } from 'react';
import type {
  BufferGeometry,
  Group,
} from 'three';

import {
  useFrame,
  useThree,
} from '@react-three/fiber';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
} from 'react';

import type { NetworkMapSiteValue } from '@/entities/network';

import { useWorldGlowMaterial } from '@/shared/3d';

import type { ISiteBannerAtlas } from '../banner/createSiteBannerAtlas';
import type { ISiteBannerCellLookup } from '../banner/createSiteBannerCellLookup';
import type { SiteBannerCellUvValue } from '../banner/siteBannerAtlasLayout';
import type { SiteMarkModeValue } from '../banner/siteMarkMetrics';
import type { OwnMarkerGeometriesValue } from '../geometry/createOwnMarkerGeometry';
import type { NetworkSceneBuildingValue } from '../layout';

import {
  buildSiteMarkSet,
  fillSiteMarkHoverMask,
  writeSiteMarkMarkerMatrices,
} from '../banner/buildSiteMarkSet';
import { createSiteBannerGeometry } from '../banner/createSiteBannerGeometry';
import { createSiteBannerMaterial } from '../banner/createSiteBannerMaterial';
import {
  createSiteBannerUniforms,
  writeSiteBannerFar,
} from '../banner/siteBannerUniforms';
import {
  resolveSiteMarkIsFar,
  writeSiteMarkModeIsFar,
} from '../banner/siteMarkMetrics';
import { INSTANCE_MATRIX_ITEM_SIZE } from '../geometry/composeInstanceMatrix';
import { createOwnMarkerGeometries } from '../geometry/createOwnMarkerGeometry';
import { SITE_MARK_AZIMUTH_EPSILON_RADIANS } from '../geometry/networkSceneMetrics';
import { readCameraZoom } from '../geometry/readCameraZoom';
import {
  applySiteMarkAzimuth,
  getCameraAzimuth,
} from '../geometry/siteMarkOrientation';
import {
  UNLIT_RIM_SPEC,
  UNLIT_ROAD_SPEC,
} from './glowSpecs';
import { InstancedLayer } from './InstancedLayer';
import { markInstanceMatricesUpdated } from './markInstanceMatricesUpdated';

interface NetworkSiteMarksProps {
  atlas: ISiteBannerAtlas | undefined;
  boxGeometry: BufferGeometry;
  buildings: readonly NetworkSceneBuildingValue[];
  hoveredId: string | undefined;
  hoveredSiteIds: readonly string[];
  markMode: SiteMarkModeValue;
  sites: readonly NetworkMapSiteValue[];
}

const EMPTY_CELL: SiteBannerCellUvValue = { u0: 0, u1: 0, v0: 0, v1: 0 };

const EMPTY_CELL_LOOKUP: ISiteBannerCellLookup = {
  getFarCell: (): SiteBannerCellUvValue => EMPTY_CELL,
  getNearCell: (): SiteBannerCellUvValue => EMPTY_CELL,
};

export const NetworkSiteMarks = ({
  atlas,
  boxGeometry,
  buildings,
  hoveredId,
  hoveredSiteIds,
  markMode,
  sites,
}: NetworkSiteMarksProps): ReactElement => {
  const camera = useThree(state => state.camera);
  const invalidate = useThree(state => state.invalidate);

  const outlineMaterial = useWorldGlowMaterial(UNLIT_ROAD_SPEC);
  const silhouetteMaterial = useWorldGlowMaterial(UNLIT_RIM_SPEC);

  const groupRef = useRef<Group>(null);
  const azimuthRef = useRef(0);

  const uniforms = useMemo(() => createSiteBannerUniforms(), []);
  const set = useMemo(
    () => buildSiteMarkSet(buildings, sites, atlas ?? EMPTY_CELL_LOOKUP),
    [atlas, buildings, sites],
  );
  const bannerGeometry = useMemo(() => createSiteBannerGeometry(set), [set]);
  const bannerMaterial = useMemo(
    () => atlas === undefined ? undefined : createSiteBannerMaterial(atlas.texture, uniforms),
    [atlas, uniforms],
  );
  const markerGeometries = useMemo((): OwnMarkerGeometriesValue => createOwnMarkerGeometries(), []);

  const applyView = useCallback((azimuth: number, isFar: boolean): void => {
    writeSiteMarkModeIsFar(markMode, isFar);
    writeSiteBannerFar(uniforms, isFar);
    applySiteMarkAzimuth(set.matrices, set.count, azimuth, set.hoverMask);
    writeSiteMarkMarkerMatrices(set, isFar);
    markInstanceMatricesUpdated(groupRef.current);
  }, [markMode, set, uniforms]);

  useFrame((state) => {
    const azimuth = getCameraAzimuth(state.camera.quaternion);
    const isFar = resolveSiteMarkIsFar(readCameraZoom(state.camera), markMode.isFar);

    if (Math.abs(azimuth - azimuthRef.current) < SITE_MARK_AZIMUTH_EPSILON_RADIANS && isFar === markMode.isFar) {
      return;
    }

    azimuthRef.current = azimuth;
    applyView(azimuth, isFar);
  });

  useLayoutEffect(() => {
    const azimuth = getCameraAzimuth(camera.quaternion);

    fillSiteMarkHoverMask(set, hoveredId, hoveredSiteIds);
    azimuthRef.current = azimuth;
    applyView(azimuth, resolveSiteMarkIsFar(readCameraZoom(camera), markMode.isFar));
    invalidate();
  }, [applyView, camera, hoveredId, hoveredSiteIds, invalidate, markMode, set]);

  useEffect(() => {
    return () => {
      bannerGeometry.dispose();
    };
  }, [bannerGeometry]);

  useEffect(() => {
    return () => {
      bannerMaterial?.dispose();
    };
  }, [bannerMaterial]);

  useEffect(() => {
    return () => {
      markerGeometries.house.dispose();
      markerGeometries.outline.dispose();
    };
  }, [markerGeometries]);

  return (
    <>
      <group ref={groupRef}>
        {bannerMaterial !== undefined && (
          <InstancedLayer
            count={set.count}
            delays={undefined}
            geometry={bannerGeometry}
            hasShadowCast={false}
            hasShadowReceive={false}
            material={bannerMaterial}
            matrices={set.matrices}
            tints={undefined}
          />
        )}
        <InstancedLayer
          count={set.ownSlots.length}
          delays={undefined}
          geometry={markerGeometries.outline}
          hasShadowCast={false}
          hasShadowReceive={false}
          material={outlineMaterial}
          matrices={set.markerMatrices}
          tints={undefined}
        />
        <InstancedLayer
          count={set.ownSlots.length}
          delays={undefined}
          geometry={markerGeometries.house}
          hasShadowCast={false}
          hasShadowReceive={false}
          material={silhouetteMaterial}
          matrices={set.markerMatrices}
          tints={undefined}
        />
      </group>
      <InstancedLayer
        count={set.postMatrices.length / INSTANCE_MATRIX_ITEM_SIZE}
        delays={undefined}
        geometry={boxGeometry}
        hasShadowCast={false}
        hasShadowReceive={false}
        material={silhouetteMaterial}
        matrices={set.postMatrices}
        tints={undefined}
      />
    </>
  );
};
