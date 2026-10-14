import { useThree } from '@react-three/fiber';
import { useEffect } from 'react';

import { useShadowMapRefresh } from '../lighting/shadowMapRefresh';

export const WebglContextRecovery = (): null => {
  const canvas = useThree(state => state.gl.domElement);
  const refreshShadowMap = useShadowMapRefresh();

  useEffect(() => {
    const handleContextRestored = (): void => {
      refreshShadowMap();
    };

    canvas.addEventListener('webglcontextrestored', handleContextRestored);

    return () => {
      canvas.removeEventListener('webglcontextrestored', handleContextRestored);
    };
  }, [canvas, refreshShadowMap]);

  return null;
};
