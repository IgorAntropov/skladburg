import { CylinderGeometry } from 'three';

import { PLAZA_SEGMENTS } from './networkSceneMetrics';

export const createPlazaGeometry = (): CylinderGeometry => new CylinderGeometry(1, 1, 1, PLAZA_SEGMENTS).translate(0, 0.5, 0);
