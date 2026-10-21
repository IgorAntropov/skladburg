import { BoxGeometry } from 'three';

export const createUnitBoxGeometry = (): BoxGeometry => new BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
