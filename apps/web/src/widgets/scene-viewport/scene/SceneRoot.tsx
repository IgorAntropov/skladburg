import type {
  ReactElement,
  ReactNode,
} from 'react';

import {
  lazy,
  Suspense,
  useMemo,
  useRef,
  useState,
} from 'react';

import type {
  AutoQualitySettingsValue,
  IIsometricCameraRig,
  QualityLevelValue,
  SceneWorldValue,
  ShadowMapSizeValue,
} from '@/shared/3d';
import type { SceneInsetsValue } from '@/shared/lib/viewport';

import {
  AutoQualityMonitor,
  DayNightRig,
  IsometricCameraRig,
  QUALITY_LEVEL_SETTINGS,
  readWorldPalette,
  SceneCanvas,
  WorldGeometryProvider,
  WorldMaterialsProvider,
} from '@/shared/3d';

import type { SceneCameraCommandSubscription } from '../model/subscribeToSceneCameraCommands';

import { useSceneCameraCommands } from './useSceneCameraCommands';

interface SceneRootProps {
  autoQuality: AutoQualitySettingsValue | undefined;
  content: ReactNode;
  dprCeiling: number;
  focusInsets: SceneInsetsValue;
  isNight: boolean;
  isReducedMotion: boolean;
  isStatsShown: boolean;
  level: QualityLevelValue;
  onAutoLevelChange: (level: QualityLevelValue) => void;
  onCameraJump: () => void;
  onContextLost: () => void;
  onReady: () => void;
  shadowMapSize: ShadowMapSizeValue;
  subscribeToCameraCommands: SceneCameraCommandSubscription;
  world: SceneWorldValue;
}

const SceneDevStats = import.meta.env.DEV ? lazy(() => import('./SceneDevStats')) : undefined;

const readDocumentProperty = (name: string): string => {
  return getComputedStyle(document.documentElement).getPropertyValue(name);
};

const SceneRoot = ({
  autoQuality,
  content,
  dprCeiling,
  focusInsets,
  isNight,
  isReducedMotion,
  isStatsShown,
  level,
  onAutoLevelChange,
  onCameraJump,
  onContextLost,
  onReady,
  shadowMapSize,
  subscribeToCameraCommands,
  world,
}: SceneRootProps): ReactElement => {
  const rigRef = useRef<IIsometricCameraRig>(null);
  const [palette] = useState(() => readWorldPalette(readDocumentProperty));

  const dpr = useMemo((): [number, number] => {
    const [minDpr, levelMaxDpr] = QUALITY_LEVEL_SETTINGS[level].dpr;

    return [minDpr, Math.min(levelMaxDpr, dprCeiling)];
  }, [dprCeiling, level]);

  useSceneCameraCommands(rigRef, subscribeToCameraCommands);

  const isStatsVisible = SceneDevStats !== undefined && isStatsShown;

  return (
    <SceneCanvas dpr={dpr} onContextLost={onContextLost} onReady={onReady}>
      <IsometricCameraRig
        focusInsets={focusInsets}
        isReducedMotion={isReducedMotion}
        onJump={onCameraJump}
        ref={rigRef}
        world={world}
      />
      <WorldMaterialsProvider palette={palette}>
        <WorldGeometryProvider>
          <DayNightRig
            isNight={isNight}
            isReducedMotion={isReducedMotion}
            level={level}
            shadowMapSize={shadowMapSize}
            world={world}
          />
          {content}
        </WorldGeometryProvider>
      </WorldMaterialsProvider>
      {autoQuality !== undefined && (
        <AutoQualityMonitor
          ceiling={autoQuality.ceiling}
          changeCount={autoQuality.changeCount}
          level={level}
          onLevelChange={onAutoLevelChange}
        />
      )}
      {isStatsVisible && (
        <Suspense fallback={null}>
          <SceneDevStats />
        </Suspense>
      )}
    </SceneCanvas>
  );
};

export default SceneRoot;
