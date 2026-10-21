import { useThree } from '@react-three/fiber';
import { useEffect } from 'react';

export const useGlowProgramWarmup = (): void => {
  const camera = useThree(state => state.camera);
  const gl = useThree(state => state.gl);
  const scene = useThree(state => state.scene);

  useEffect(() => {
    let isCancelled = false;

    const payFirstUse = (): void => {
      if (isCancelled) {
        return;
      }

      for (const program of gl.info.programs ?? []) {
        program.getUniforms();
      }
    };

    void gl.compileAsync(scene, camera).then(payFirstUse);

    return () => {
      isCancelled = true;
    };
  }, [camera, gl, scene]);
};
