import {
  useEffect,
  useRef,
} from 'react';

import { useSceneCameraRig } from '@/shared/3d';

import type { NetworkSceneInteractionValue } from '../../model/networkSceneInteraction';
import type { NetworkSceneLayoutValue } from '../layout';

import {
  resolveFocusZoomFactor,
  resolveNetworkFocusTarget,
} from './resolveNetworkFocusTarget';

interface PendingFocusValue {
  id: string;
  isRequested: boolean;
}

export const useNetworkCameraFocus = (
  layout: NetworkSceneLayoutValue,
  interaction: NetworkSceneInteractionValue | undefined,
): void => {
  const rigRef = useSceneCameraRig();

  const isInitializedRef = useRef(false);
  const handledSequenceRef = useRef<number | undefined>(undefined);
  const pendingRef = useRef<PendingFocusValue | undefined>(undefined);

  useEffect(() => {
    if (interaction === undefined) {
      return;
    }

    const { focusRequest, selected } = interaction;

    if (!isInitializedRef.current) {
      isInitializedRef.current = true;
      handledSequenceRef.current = focusRequest?.sequence;
      pendingRef.current = selected === undefined ? undefined : { id: selected.id, isRequested: false };
    }
    else if (focusRequest !== undefined && focusRequest.sequence !== handledSequenceRef.current) {
      handledSequenceRef.current = focusRequest.sequence;
      pendingRef.current = { id: focusRequest.id, isRequested: true };
    }

    const pending = pendingRef.current;

    if (pending === undefined) {
      return;
    }

    if (!pending.isRequested && selected?.id !== pending.id) {
      pendingRef.current = undefined;

      return;
    }

    const rig = rigRef.current;
    const target = resolveNetworkFocusTarget(layout, pending.id);

    if (rig === null || target === undefined) {
      return;
    }

    pendingRef.current = undefined;

    const zoom = resolveFocusZoomFactor(layout.world.home.radius, target.radius);

    console.log('> useNetworkCameraFocus -> focus:', { id: pending.id, isRequested: pending.isRequested, zoom });
    rig.flyTo(target.point, { zoom });
  }, [interaction, layout, rigRef]);
};
