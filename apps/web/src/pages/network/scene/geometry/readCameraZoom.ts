import type { Camera } from 'three';

import { OrthographicCamera } from 'three';

export const readCameraZoom = (camera: Camera): number => camera instanceof OrthographicCamera ? camera.zoom : 0;
