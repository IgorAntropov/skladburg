import type {
  ComponentType,
  ReactElement,
} from 'react';

import {
  lazy,
  Suspense,
  useMemo,
  useRef,
  useState,
} from 'react';

import type {
  IIsometricCameraRig,
  QualityLevelValue,
  SceneBoundsValue,
  SceneViewBoxValue,
} from '@/shared/3d';

import {
  DayLight,
  IsometricCameraRig,
  QUALITY_LEVEL_SETTINGS,
  readWorldPalette,
  SceneCanvas,
  WorldMaterialsProvider,
} from '@/shared/3d';

import type { SceneCameraCommandSubscription } from '../model/subscribeToSceneCameraCommands';

import { useSceneCameraCommands } from './useSceneCameraCommands';

interface SceneRootProps {
  bounds: SceneBoundsValue;
  Content: ComponentType;
  dprCeiling: number;
  isReducedMotion: boolean;
  isStatsShown: boolean;
  level: QualityLevelValue;
  onCameraJump: () => void;
  onReady: () => void;
  subscribeToCameraCommands: SceneCameraCommandSubscription;
  viewBox: SceneViewBoxValue;
}

const SceneDevStats = import.meta.env.DEV ? lazy(() => import('./SceneDevStats')) : undefined;

const readDocumentProperty = (name: string): string => {
  return getComputedStyle(document.documentElement).getPropertyValue(name);
};

const SceneRoot = ({
  bounds,
  Content,
  dprCeiling,
  isReducedMotion,
  isStatsShown,
  level,
  onCameraJump,
  onReady,
  subscribeToCameraCommands,
  viewBox,
}: SceneRootProps): ReactElement => {
  const rigRef = useRef<IIsometricCameraRig>(null);
  const [palette] = useState(() => readWorldPalette(readDocumentProperty));

  const dpr = useMemo((): readonly [number, number] => {
    const [minDpr, levelMaxDpr] = QUALITY_LEVEL_SETTINGS[level].dpr;

    return [minDpr, Math.min(levelMaxDpr, dprCeiling)];
  }, [dprCeiling, level]);

  useSceneCameraCommands(rigRef, subscribeToCameraCommands);

  const isStatsVisible = SceneDevStats !== undefined && isStatsShown;

  return (
    <SceneCanvas background={palette.background} dpr={dpr} onReady={onReady}>
      <IsometricCameraRig
        bounds={bounds}
        isReducedMotion={isReducedMotion}
        onJump={onCameraJump}
        ref={rigRef}
        viewBox={viewBox}
      />
      <WorldMaterialsProvider palette={palette}>
        <DayLight />
        <Content />
      </WorldMaterialsProvider>
      {isStatsVisible && (
        <Suspense fallback={null}>
          <SceneDevStats />
        </Suspense>
      )}
    </SceneCanvas>
  );
};

export default SceneRoot;
