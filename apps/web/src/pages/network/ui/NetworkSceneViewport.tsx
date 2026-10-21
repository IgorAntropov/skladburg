import type { ReactElement } from 'react';

import {
  useCallback,
  useMemo,
} from 'react';

import type { NetworkMapModelValue } from '@/entities/network';
import type { ObjectRefValue } from '@/shared/routing';

import { useNavigate } from '@/shared/routing';
import { SceneViewport } from '@/widgets/scene-viewport';

import type {
  NetworkMapTargetValue,
  NetworkSceneInteractionValue,
} from '../model/networkSceneInteraction';

import { resolveNetworkSelectedTarget } from '../lib/resolveNetworkSelectedTarget';
import { useNetworkMapStore } from '../model/useNetworkMapStore';
import { loadNetworkScene } from './loadNetworkScene';

interface NetworkSceneViewportProps {
  focus: ObjectRefValue | undefined;
  label: string;
  onWorldSiteSelect: () => void;
  sceneData: NetworkMapModelValue | undefined;
}

export const NetworkSceneViewport = ({
  focus,
  label,
  onWorldSiteSelect,
  sceneData,
}: NetworkSceneViewportProps): ReactElement => {
  const navigate = useNavigate();
  const hoveredId = useNetworkMapStore(state => state.hoveredId);
  const focusRequest = useNetworkMapStore(state => state.focusRequest);
  const setHoveredId = useNetworkMapStore(state => state.setHoveredId);
  const clearHoveredId = useNetworkMapStore(state => state.clearHoveredId);

  const focusId = focus?.id;
  const focusType = focus?.type;
  const selected = useMemo(() => resolveNetworkSelectedTarget(focusId, focusType), [focusId, focusType]);

  const handleSelect = useCallback((target: NetworkMapTargetValue): void => {
    console.log('> NetworkSceneViewport -> handleSelect:', target);
    navigate({ kind: 'object', object: { id: target.id, type: target.kind } });

    if (target.kind === 'site') {
      onWorldSiteSelect();
    }
  }, [navigate, onWorldSiteSelect]);

  const handleHoverStart = useCallback((id: string): void => {
    console.log('> NetworkSceneViewport -> handleHoverStart:', { id });
    setHoveredId(id);
  }, [setHoveredId]);

  const handleHoverEnd = useCallback((id: string): void => {
    console.log('> NetworkSceneViewport -> handleHoverEnd:', { id });
    clearHoveredId(id);
  }, [clearHoveredId]);

  const interaction = useMemo((): NetworkSceneInteractionValue => ({
    focusRequest,
    hoveredId,
    onHoverEnd: handleHoverEnd,
    onHoverStart: handleHoverStart,
    onSelect: handleSelect,
    selected,
  }), [focusRequest, handleHoverEnd, handleHoverStart, handleSelect, hoveredId, selected]);

  return (
    <SceneViewport
      interaction={interaction}
      label={label}
      loadScene={loadNetworkScene}
      sceneData={sceneData}
    />
  );
};
