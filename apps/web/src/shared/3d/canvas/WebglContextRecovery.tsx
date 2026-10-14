import { useThree } from '@react-three/fiber';
import {
  useEffect,
  useRef,
} from 'react';

import { useShadowMapRefresh } from '../lighting/shadowMapRefresh';
import {
  CONTEXT_RESTORE_TIMEOUT_MS,
  createContextLossWatch,
} from './createContextLossWatch';

interface WebglContextRecoveryProps {
  onContextLost: () => void;
}

export const WebglContextRecovery = ({ onContextLost }: WebglContextRecoveryProps): null => {
  const canvas = useThree(state => state.gl.domElement);
  const refreshShadowMap = useShadowMapRefresh();
  const onContextLostRef = useRef(onContextLost);

  useEffect(() => {
    onContextLostRef.current = onContextLost;
  }, [onContextLost]);

  useEffect(() => {
    const watch = createContextLossWatch({
      isPageVisible: () => document.visibilityState === 'visible',
      onTimeout: () => {
        console.log('> WebglContextRecovery -> handleRestoreTimeout:', { timeoutMs: CONTEXT_RESTORE_TIMEOUT_MS });
        onContextLostRef.current();
      },
      timeoutMs: CONTEXT_RESTORE_TIMEOUT_MS,
    });

    const handleContextLost = (): void => {
      console.log('> WebglContextRecovery -> handleContextLost:', { timeoutMs: CONTEXT_RESTORE_TIMEOUT_MS });
      watch.lost();
    };

    const handleContextRestored = (): void => {
      console.log('> WebglContextRecovery -> handleContextRestored:', {});
      watch.restored();
      refreshShadowMap();
    };

    const handleVisibilityChange = (): void => {
      watch.visibilityChanged();
    };

    canvas.addEventListener('webglcontextlost', handleContextLost);
    canvas.addEventListener('webglcontextrestored', handleContextRestored);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      canvas.removeEventListener('webglcontextlost', handleContextLost);
      canvas.removeEventListener('webglcontextrestored', handleContextRestored);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      watch.dispose();
    };
  }, [canvas, refreshShadowMap]);

  return null;
};
