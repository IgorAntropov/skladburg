import type { ReactElement } from 'react';

import {
  useCallback,
  useMemo,
} from 'react';

import type {
  NetworkMapModelValue,
  NetworkMapSiteValue,
} from '@/entities/network';
import type { ObjectRefValue } from '@/shared/routing';

import { useNavigate } from '@/shared/routing';
import { SceneViewport } from '@/widgets/scene-viewport';

import type {
  NetworkMapTargetValue,
  NetworkSceneInteractionValue,
} from '../model/networkSceneInteraction';

import { listOrganizationSiteIds } from '../lib/listOrganizationSiteIds';
import { resolveNetworkFocusRequest } from '../lib/resolveNetworkFocusRequest';
import { resolveNetworkSelectedTarget } from '../lib/resolveNetworkSelectedTarget';
import { useAddressFocusRequest } from '../model/useAddressFocusRequest';
import { useNetworkMapStore } from '../model/useNetworkMapStore';
import { loadNetworkScene } from './loadNetworkScene';

const NO_SITES: readonly NetworkMapSiteValue[] = [];

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
  const hoveredOrganizationId = useNetworkMapStore(state => state.hoveredOrganizationId);
  const focusCommand = useNetworkMapStore(state => state.focusCommand);
  const setHoveredId = useNetworkMapStore(state => state.setHoveredId);
  const clearHoveredId = useNetworkMapStore(state => state.clearHoveredId);

  useAddressFocusRequest(focus);

  const focusId = focus?.id;
  const focusType = focus?.type;
  const sites = sceneData?.sites ?? NO_SITES;
  const selected = useMemo(() => resolveNetworkSelectedTarget(focusId, focusType, sites), [focusId, focusType, sites]);
  const focusRequest = useMemo(() => resolveNetworkFocusRequest(focusCommand, sites), [focusCommand, sites]);
  const hoveredSiteIds = useMemo(() => listOrganizationSiteIds(sites, hoveredOrganizationId), [hoveredOrganizationId, sites]);

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
    hoveredSiteIds,
    onHoverEnd: handleHoverEnd,
    onHoverStart: handleHoverStart,
    onSelect: handleSelect,
    selected,
  }), [
    focusRequest,
    handleHoverEnd,
    handleHoverStart,
    handleSelect,
    hoveredId,
    hoveredSiteIds,
    selected,
  ]);

  return (
    <SceneViewport
      interaction={interaction}
      label={label}
      loadScene={loadNetworkScene}
      sceneData={sceneData}
    />
  );
};
