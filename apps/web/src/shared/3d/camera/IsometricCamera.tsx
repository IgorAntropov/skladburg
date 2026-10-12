import { useThree } from '@react-three/fiber';
import { useLayoutEffect } from 'react';
import { OrthographicCamera } from 'three';

import type { SceneBoundsValue } from '../world/sceneBounds';

import { applyIsometricFit } from './applyIsometricFit';
import { fitBoundsToViewport } from './fitBoundsToViewport';

interface IsometricCameraProps {
  bounds: SceneBoundsValue;
}

export const IsometricCamera = ({ bounds }: IsometricCameraProps): null => {
  const camera = useThree(state => state.camera);
  const invalidate = useThree(state => state.invalidate);
  const viewportWidth = useThree(state => state.size.width);
  const viewportHeight = useThree(state => state.size.height);

  useLayoutEffect(() => {
    if (!(camera instanceof OrthographicCamera)) {
      return;
    }

    applyIsometricFit(camera, fitBoundsToViewport({
      bounds,
      viewport: {
        height: viewportHeight,
        width: viewportWidth,
      },
    }));
    invalidate();
  }, [bounds, camera, invalidate, viewportHeight, viewportWidth]);

  return null;
};
