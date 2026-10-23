import type { WebGLRenderer } from 'three';

type ExposureRendererValue = Pick<WebGLRenderer, 'toneMappingExposure'>;

export const readToneExposure = (renderer: ExposureRendererValue): number => renderer.toneMappingExposure;

export const writeToneExposure = (renderer: ExposureRendererValue, exposure: number): void => {
  renderer.toneMappingExposure = exposure;
};
