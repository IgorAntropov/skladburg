import type { ReactElement } from 'react';
import type {
  BufferGeometry,
  InstancedMesh,
  Material,
} from 'three';

import { useThree } from '@react-three/fiber';
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
} from 'react';
import {
  Color,
  DynamicDrawUsage,
  MeshStandardMaterial,
} from 'three';

import { useWorldPalette } from '@/shared/3d';

import type { NetworkTripActorsValue } from '../../model/networkTripActor';
import type { NetworkSceneLayoutValue } from '../layout';
import type { NetworkTripRenderValue } from './useNetworkTripAnimation';

import {
  readSiteBannerColors,
  toCssColor,
} from '../banner/siteBannerColors';
import { siteBannerLogoLoader } from '../banner/siteBannerLogos';
import { INSTANCE_MATRIX_ITEM_SIZE } from '../geometry/composeInstanceMatrix';
import { hashText } from '../layout/layoutHash';
import { createNetworkTruckDecals } from './createNetworkTruckDecals';
import { createNetworkTruckGeometry } from './createNetworkTruckGeometry';
import { buildNetworkTripPath } from './networkTripPath';
import { useNetworkTripAnimation } from './useNetworkTripAnimation';

type MeshArgsValue = [BufferGeometry, Material, number];

interface NetworkTripActorsProps {
  layout: NetworkSceneLayoutValue;
  tracks: NetworkTripActorsValue;
}

interface NetworkTruckLayerProps {
  entries: readonly NetworkTripRenderValue[];
  readWorldTimeMs: () => number;
}

const NetworkTruckLayer = ({ entries, readWorldTimeMs }: NetworkTruckLayerProps): ReactElement => {
  const invalidate = useThree(state => state.invalidate);
  const palette = useWorldPalette();
  const body = useRef<InstancedMesh>(null);
  const decals = useRef<InstancedMesh>(null);
  const actors = useMemo(() => entries.map(entry => entry.actor), [entries]);
  const colors = useMemo(() => readSiteBannerColors(palette), [palette]);
  const decalsResources = useMemo(() => createNetworkTruckDecals(actors, colors), [actors, colors]);
  const material = useMemo(() => new MeshStandardMaterial({ roughness: 0.9, vertexColors: true }), []);
  const geometry = useMemo(
    () => createNetworkTruckGeometry({
      box: new Color(toCssColor(palette.bannerPlate)),
      cab: new Color(toCssColor(palette.warehouseWall)),
      chassis: new Color(toCssColor(palette.bannerText)),
      glass: new Color(toCssColor(palette.windowGlass)),
      hub: new Color(toCssColor(palette.road)),
    }),
    [palette],
  );
  const bodyArgs = useMemo((): MeshArgsValue => [geometry, material, entries.length], [entries.length, geometry, material]);
  const decalsArgs = useMemo(
    (): MeshArgsValue | undefined => decalsResources === undefined
      ? undefined
      : [decalsResources.geometry, decalsResources.material, entries.length],
    [decalsResources, entries.length],
  );

  const matrixArgs = useMemo(
    (): [Float32Array, number] => [new Float32Array(entries.length * INSTANCE_MATRIX_ITEM_SIZE), INSTANCE_MATRIX_ITEM_SIZE],
    [entries.length],
  );

  useNetworkTripAnimation({ body, decals, entries, matrices: matrixArgs[0], readWorldTimeMs });

  useLayoutEffect(() => {
    const mesh = body.current;

    if (mesh === null) {
      return;
    }

    const tint = new Color();

    for (const [index, actor] of actors.entries()) {
      const shade = 1 - (hashText(actor.id) % 5) * 0.04;

      mesh.setColorAt(index, tint.setScalar(shade));
    }

    if (mesh.instanceColor !== null) {
      mesh.instanceColor.needsUpdate = true;
    }
  }, [actors, bodyArgs]);

  useLayoutEffect(() => {
    decalsResources?.redraw();
  }, [decalsResources]);

  useEffect(() => {
    const paths = actors.flatMap(({ brandLogoPath }) => (
      brandLogoPath !== undefined && siteBannerLogoLoader.peek(brandLogoPath) === undefined ? [brandLogoPath] : []
    ));

    if (decalsResources === undefined || paths.length === 0) {
      return undefined;
    }

    let isCancelled = false;

    siteBannerLogoLoader.load(paths).then(() => {
      if (!isCancelled) {
        decalsResources.redraw();
        invalidate();
      }
    }).catch((error: unknown) => {
      console.log('> NetworkTripActors -> loadLogos:', { error });
    });

    return () => {
      isCancelled = true;
    };
  }, [actors, decalsResources, invalidate]);

  useEffect(() => () => {
    geometry.dispose();
  }, [geometry]);
  useEffect(() => () => {
    material.dispose();
  }, [material]);
  useEffect(() => (): void => decalsResources?.dispose(), [decalsResources]);

  return (
    <>
      <instancedMesh args={bodyArgs} frustumCulled={false} ref={body}>
        <instancedBufferAttribute args={matrixArgs} attach="instanceMatrix" usage={DynamicDrawUsage} />
      </instancedMesh>
      {decalsArgs !== undefined && (
        <instancedMesh args={decalsArgs} frustumCulled={false} ref={decals}>
          <instancedBufferAttribute args={matrixArgs} attach="instanceMatrix" usage={DynamicDrawUsage} />
        </instancedMesh>
      )}
    </>
  );
};

export const NetworkTripActors = ({ layout, tracks }: NetworkTripActorsProps): null | ReactElement => {
  const entries = useMemo((): NetworkTripRenderValue[] => tracks.actors.flatMap((actor) => {
    const path = buildNetworkTripPath(actor, layout);

    return path === undefined ? [] : [{ actor, path }];
  }), [layout, tracks.actors]);

  return entries.length === 0 ? null : <NetworkTruckLayer entries={entries} readWorldTimeMs={tracks.readWorldTimeMs} />;
};
