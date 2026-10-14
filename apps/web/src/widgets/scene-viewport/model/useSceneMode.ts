import {
  useEffect,
  useMemo,
} from 'react';

import type { SceneModeValue } from '@/features/scene-settings';
import type { ViewportClassValue } from '@/shared/lib/viewport';

import {
  resolveSceneMode,
  useSceneSettingsStore,
} from '@/features/scene-settings';

import {
  isSoftwareRenderer,
  isWebGlSupported,
} from '../lib/webGlSupport';

export const useSceneMode = (viewportClass: ViewportClassValue): SceneModeValue => {
  const autoLevel = useSceneSettingsStore(state => state.autoLevel);
  const isSceneUnavailable = useSceneSettingsStore(state => state.isSceneUnavailable);
  const markSceneUnavailable = useSceneSettingsStore(state => state.markSceneUnavailable);
  const preference = useSceneSettingsStore(state => state.preference);
  const reportAutoLevel = useSceneSettingsStore(state => state.reportAutoLevel);

  const mode = useMemo(
    () => resolveSceneMode({
      autoLevel,
      isSoftwareRenderer,
      isWebGlAvailable: () => !isSceneUnavailable && isWebGlSupported(),
      preference,
      viewportClass,
    }),
    [autoLevel, isSceneUnavailable, preference, viewportClass],
  );

  const isWebGlMissing = mode.kind === 'off' && mode.reason === 'noWebGl';
  const startAutoLevel = mode.kind === '3d' && mode.isAuto && mode.level !== autoLevel ? mode.level : undefined;

  useEffect(() => {
    if (isWebGlMissing && !isSceneUnavailable) {
      console.log('> useSceneMode -> markSceneUnavailable:', { reason: 'noWebGl' });
      markSceneUnavailable();
    }
  }, [isSceneUnavailable, isWebGlMissing, markSceneUnavailable]);

  useEffect(() => {
    if (startAutoLevel !== undefined) {
      console.log('> useSceneMode -> reportAutoLevel:', { level: startAutoLevel, source: 'start' });
      reportAutoLevel(startAutoLevel, 'start');
    }
  }, [reportAutoLevel, startAutoLevel]);

  return mode;
};
