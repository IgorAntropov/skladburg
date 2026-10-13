import type { RefObject } from 'react';
import type { Object3D } from 'three';

export interface CameraViewValue {
  target: ScenePointValue;
  zoom: number;
}

export interface FlyToOptionsValue {
  zoom?: number | undefined;
}

export interface FocusShiftValue {
  x: number;
  y: number;
}

export interface IIsometricCameraRig {
  flyTo: (target: ScenePointValue, options?: FlyToOptionsValue) => void;
  follow: (target: RefObject<null | Object3D> | undefined) => void;
  home: () => void;
  rotate: (direction: -1 | 1) => void;
  zoom: (direction: -1 | 1) => void;
}

export interface ScenePointValue {
  x: number;
  y: number;
  z: number;
}

export interface ViewportSizeValue {
  height: number;
  width: number;
}
