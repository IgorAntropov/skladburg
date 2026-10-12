import { useThree } from '@react-three/fiber';
import { useEffect } from 'react';

export const WebglContextRecovery = (): null => {
  const canvas = useThree(state => state.gl.domElement);
  const invalidate = useThree(state => state.invalidate);

  useEffect(() => {
    const handleContextRestored = (): void => {
      invalidate();
    };

    canvas.addEventListener('webglcontextrestored', handleContextRestored);

    return () => {
      canvas.removeEventListener('webglcontextrestored', handleContextRestored);
    };
  }, [canvas, invalidate]);

  return null;
};
