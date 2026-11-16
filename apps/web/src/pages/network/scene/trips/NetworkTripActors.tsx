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
  useState,
} from 'react';
import {
  Color,
  DynamicDrawUsage,
  MeshStandardMaterial,
} from 'three';

import type { QualityLevelValue } from '@/shared/3d';

import { useWorldPalette } from '@/shared/3d';

import type { NetworkTripActorsValue } from '../../model/networkTripActor';
import type { NetworkSceneLayoutValue } from '../layout';
import type { WorldModelDataValue } from '../models/format/worldModelFormat';
import type { NetworkTripRenderValue } from './useNetworkTripAnimation';

import {
  readSiteBannerColors,
  toCssColor,
} from '../banner/siteBannerColors';
import { siteBannerLogoLoader } from '../banner/siteBannerLogos';
import { INSTANCE_MATRIX_ITEM_SIZE } from '../geometry/composeInstanceMatrix';
import { hashText } from '../layout/layoutHash';
import { createWorldModelGeometry } from '../models/createWorldModelGeometry';
import { loadWorldModels } from '../models/loadWorldModels';
import { useWorldModelMaterials } from '../models/useWorldModelMaterials';
import {
  NETWORK_TRUCK_LIGHT_MODEL,
  NETWORK_TRUCK_MODEL,
} from '../models/worldModelCatalog';
import { createNetworkTruckDecals } from './createNetworkTruckDecals';
import { createNetworkTruckGeometry } from './createNetworkTruckGeometry';
import { buildNetworkTripPath } from './networkTripPath';
import { useNetworkTripAnimation } from './useNetworkTripAnimation';

interface LoadedNetworkTruckValue {
  data: WorldModelDataValue;
  id: string;
}

type MeshArgsValue = [BufferGeometry, Material, number];

interface NetworkTripActorsProps {
  layout: NetworkSceneLayoutValue;
  level: QualityLevelValue;
  tracks: NetworkTripActorsValue;
}

interface NetworkTruckLayerProps {
  entries: readonly NetworkTripRenderValue[];
  level: QualityLevelValue;
  readWorldTimeMs: () => number;
}

const NetworkTruckLayer = ({ entries, level, readWorldTimeMs }: NetworkTruckLayerProps): ReactElement => {
  const invalidate = useThree(state => state.invalidate);
  const palette = useWorldPalette();
  const modelMaterials = useWorldModelMaterials();
  const [loadedModel, setLoadedModel] = useState<LoadedNetworkTruckValue>();
  const body = useRef<InstancedMesh>(null);
  const decals = useRef<InstancedMesh>(null);
  const modelId = level === 'low' ? NETWORK_TRUCK_LIGHT_MODEL.id : NETWORK_TRUCK_MODEL.id;
  const actors = useMemo(() => entries.map(entry => entry.actor), [entries]);
  const model = loadedModel?.id === modelId ? loadedModel.data : loadWorldModels.peek(modelId);
  const hasModel = model !== undefined;
  const colors = useMemo(() => readSiteBannerColors(palette), [palette]);
  const decalsResources = useMemo(() => createNetworkTruckDecals(actors, colors, hasModel), [actors, colors, hasModel]);
  const material = useMemo(() => new MeshStandardMaterial({ roughness: 0.9, vertexColors: true }), []);
  const geometry = useMemo(
    () => model === undefined
      ? createNetworkTruckGeometry({
          box: new Color(toCssColor(palette.bannerPlate)),
          cab: new Color(toCssColor(palette.warehouseWall)),
          chassis: new Color(toCssColor(palette.bannerText)),
          glass: new Color(toCssColor(palette.windowGlass)),
          hub: new Color(toCssColor(palette.road)),
        })
      : createWorldModelGeometry(model),
    [model, palette],
  );
  const bodyMaterial = model === undefined ? material : modelMaterials.warehouse;
  const bodyArgs = useMemo((): MeshArgsValue => [geometry, bodyMaterial, entries.length], [bodyMaterial, entries.length, geometry]);
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

  useEffect(() => {
    if (model !== undefined) {
      return undefined;
    }

    let isCancelled = false;
    loadWorldModels([modelId]).then((models) => {
      const data = models.get(modelId);
      if (!isCancelled && data !== undefined) {
        setLoadedModel({ data, id: modelId });
      }
    }).catch((error: unknown) => {
      console.log('> NetworkTripActors -> loadModel:', { error, modelId });
    });

    return () => {
      isCancelled = true;
    };
  }, [model, modelId]);

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

export const NetworkTripActors = ({ layout, level, tracks }: NetworkTripActorsProps): null | ReactElement => {
  const entries = useMemo((): NetworkTripRenderValue[] => tracks.actors.flatMap((actor) => {
    const path = buildNetworkTripPath(actor, layout);

    return path === undefined ? [] : [{ actor, path }];
  }), [layout, tracks.actors]);

  return entries.length === 0 ? null : <NetworkTruckLayer entries={entries} level={level} readWorldTimeMs={tracks.readWorldTimeMs} />;
};
