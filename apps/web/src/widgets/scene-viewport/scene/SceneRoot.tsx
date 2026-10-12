import type {
  ComponentType,
  ReactElement,
} from 'react';

import {
  lazy,
  Suspense,
  useMemo,
  useState,
} from 'react';

import type {
  QualityLevelValue,
  SceneBoundsValue,
} from '@/shared/3d';

import {
  DayLight,
  QUALITY_LEVEL_SETTINGS,
  readWorldPalette,
  SceneCanvas,
  WorldMaterialsProvider,
} from '@/shared/3d';

interface SceneRootProps {
  bounds: SceneBoundsValue;
  Content: ComponentType;
  dprCeiling: number;
  isStatsShown: boolean;
  level: QualityLevelValue;
  onReady: () => void;
}

const SceneDevStats = import.meta.env.DEV ? lazy(() => import('./SceneDevStats')) : undefined;

const readDocumentProperty = (name: string): string => {
  return getComputedStyle(document.documentElement).getPropertyValue(name);
};

const SceneRoot = ({
  bounds,
  Content,
  dprCeiling,
  isStatsShown,
  level,
  onReady,
}: SceneRootProps): ReactElement => {
  const [palette] = useState(() => readWorldPalette(readDocumentProperty));

  const dpr = useMemo((): readonly [number, number] => {
    const [minDpr, levelMaxDpr] = QUALITY_LEVEL_SETTINGS[level].dpr;

    return [minDpr, Math.min(levelMaxDpr, dprCeiling)];
  }, [dprCeiling, level]);

  const isStatsVisible = SceneDevStats !== undefined && isStatsShown;

  return (
    <SceneCanvas background={palette.background} bounds={bounds} dpr={dpr} onReady={onReady}>
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
