import type {
  ReactElement,
  ReactNode,
} from 'react';
import type { WebGLShadowMap } from 'three';

import { Canvas } from '@react-three/fiber';
import { PCFShadowMap } from 'three';

import { SceneReadySignal } from './SceneReadySignal';
import { WebglContextRecovery } from './WebglContextRecovery';

interface SceneCanvasProps {
  children: ReactNode;
  dpr: readonly [number, number];
  onReady: () => void;
}

const STATIC_SHADOW_MAP: Partial<WebGLShadowMap> = {
  autoUpdate: false,
  type: PCFShadowMap,
};

export const SceneCanvas = ({
  children,
  dpr,
  onReady,
}: SceneCanvasProps): ReactElement => {
  return (
    <Canvas
      dpr={[dpr[0], dpr[1]]}
      flat
      frameloop="demand"
      gl={{ antialias: true }}
      orthographic
      shadows={STATIC_SHADOW_MAP}
    >
      <WebglContextRecovery />
      <SceneReadySignal onReady={onReady} />
      {children}
    </Canvas>
  );
};
