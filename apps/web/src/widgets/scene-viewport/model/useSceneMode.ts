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

import { isWebGlSupported } from '../lib/webGlSupport';

export const useSceneMode = (viewportClass: ViewportClassValue): SceneModeValue => {
  const autoLevel = useSceneSettingsStore(state => state.autoLevel);
  const isSceneUnavailable = useSceneSettingsStore(state => state.isSceneUnavailable);
  const markSceneUnavailable = useSceneSettingsStore(state => state.markSceneUnavailable);
  const preference = useSceneSettingsStore(state => state.preference);

  const mode = useMemo(
    () => resolveSceneMode({
      autoLevel,
      isWebGlAvailable: () => !isSceneUnavailable && isWebGlSupported(),
      preference,
      viewportClass,
    }),
    [autoLevel, isSceneUnavailable, preference, viewportClass],
  );

  const isWebGlMissing = mode.kind === 'off' && mode.reason === 'noWebGl';

  useEffect(() => {
    if (isWebGlMissing && !isSceneUnavailable) {
      console.log('> useSceneMode -> markSceneUnavailable:', { reason: 'noWebGl' });
      markSceneUnavailable();
    }
  }, [isSceneUnavailable, isWebGlMissing, markSceneUnavailable]);

  return mode;
};
