import { useThree } from '@react-three/fiber';
import {
  useEffect,
  useMemo,
  useRef,
} from 'react';

import type { NetworkSceneInteractionValue } from '../../model/networkSceneInteraction';
import type { NetworkSceneLayoutValue } from '../layout';

import { createNetworkPointerPicker } from './createNetworkPointerPicker';
import { buildPickTargets } from './projectPickCandidates';

export const useNetworkPointerPicking = (
  layout: NetworkSceneLayoutValue,
  interaction: NetworkSceneInteractionValue | undefined,
): void => {
  const domElement = useThree(state => state.gl.domElement);
  const getState = useThree(state => state.get);

  const interactionRef = useRef(interaction);
  const targets = useMemo(() => buildPickTargets(layout), [layout]);
  const isInteractive = interaction !== undefined;

  useEffect(() => {
    interactionRef.current = interaction;
  }, [interaction]);

  useEffect(() => {
    if (!isInteractive) {
      return undefined;
    }

    return createNetworkPointerPicker({
      element: domElement,
      getInteraction: (): NetworkSceneInteractionValue | undefined => interactionRef.current,
      getView: getState,
      targets,
    });
  }, [domElement, getState, isInteractive, targets]);
};
