import type {
  Color,
  Scene,
} from 'three';

export const setSceneBackground = (scene: Scene, color: Color | null): void => {
  scene.background = color;
};
