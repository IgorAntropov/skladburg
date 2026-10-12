import type { OrthographicCamera } from 'three';

import type { IsometricFitValue } from './fitBoundsToViewport';

export const applyIsometricFit = (camera: OrthographicCamera, fit: IsometricFitValue): void => {
  camera.position.set(...fit.position);
  camera.near = fit.near;
  camera.far = fit.far;
  camera.zoom = fit.zoom;
  camera.lookAt(...fit.target);
  camera.updateProjectionMatrix();
};
