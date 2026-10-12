import {
  addAfterEffect,
  useThree,
} from '@react-three/fiber';
import {
  useEffect,
  useRef,
} from 'react';

interface SceneReadySignalProps {
  onReady: () => void;
}

export const SceneReadySignal = ({ onReady }: SceneReadySignalProps): null => {
  const gl = useThree(state => state.gl);
  const invalidate = useThree(state => state.invalidate);
  const onReadyRef = useRef(onReady);
  const isSignaledRef = useRef(false);

  useEffect(() => {
    onReadyRef.current = onReady;
  }, [onReady]);

  useEffect(() => {
    const unsubscribe = addAfterEffect(() => {
      const isFrameDrawn = gl.info.render.frame > 0;

      if (!isFrameDrawn || isSignaledRef.current) {
        return;
      }

      isSignaledRef.current = true;
      unsubscribe();
      onReadyRef.current();
    });

    invalidate();

    return unsubscribe;
  }, [gl, invalidate]);

  return null;
};
