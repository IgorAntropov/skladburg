import type {
  ReactElement,
  ReactNode,
} from 'react';

import { Canvas } from '@react-three/fiber';

import type { RgbaColorValue } from '@/shared/lib/color';

import type { SceneBoundsValue } from '../world/sceneBounds';

import { IsometricCamera } from '../camera/IsometricCamera';
import { SceneBackground } from './SceneBackground';
import { SceneReadySignal } from './SceneReadySignal';
import { WebglContextRecovery } from './WebglContextRecovery';

interface SceneCanvasProps {
  background: RgbaColorValue;
  bounds: SceneBoundsValue;
  children: ReactNode;
  dpr: readonly [number, number];
  onReady: () => void;
}

export const SceneCanvas = ({
  background,
  bounds,
  children,
  dpr,
  onReady,
}: SceneCanvasProps): ReactElement => {
  return (
    <Canvas dpr={[dpr[0], dpr[1]]} flat frameloop="demand" gl={{ antialias: true }} orthographic>
      <SceneBackground color={background} />
      <IsometricCamera bounds={bounds} />
      <WebglContextRecovery />
      <SceneReadySignal onReady={onReady} />
      {children}
    </Canvas>
  );
};
