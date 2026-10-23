import type {
  ReactElement,
  ReactNode,
} from 'react';
import type { WebGLShadowMap } from 'three';

import { Canvas } from '@react-three/fiber';
import { PCFShadowMap } from 'three';

import { installWorldToneCurve } from '../lighting/installWorldToneCurve';
import { RENDERER_SETTINGS } from './rendererSettings';
import { SceneReadySignal } from './SceneReadySignal';
import { WebglContextRecovery } from './WebglContextRecovery';

interface SceneCanvasProps {
  children: ReactNode;
  dpr: [number, number];
  onContextLost: () => void;
  onReady: () => void;
}

const STATIC_SHADOW_MAP: Partial<WebGLShadowMap> = {
  autoUpdate: false,
  type: PCFShadowMap,
};

installWorldToneCurve();

export const SceneCanvas = ({
  children,
  dpr,
  onContextLost,
  onReady,
}: SceneCanvasProps): ReactElement => {
  return (
    <Canvas
      dpr={dpr}
      frameloop="demand"
      gl={RENDERER_SETTINGS}
      orthographic
      shadows={STATIC_SHADOW_MAP}
    >
      <WebglContextRecovery onContextLost={onContextLost} />
      <SceneReadySignal onReady={onReady} />
      {children}
    </Canvas>
  );
};
