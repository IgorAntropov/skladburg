import type { ReactElement } from 'react';

import {
  useFrame,
  useThree,
} from '@react-three/fiber';
import {
  useLayoutEffect,
  useRef,
} from 'react';

import type { ScreenPointValue } from '../geometry/projectWorldPointToScreen';
import type { NetworkSceneCityValue } from '../layout';

import { CITY_LABEL_HEIGHT_METERS } from '../geometry/networkSceneMetrics';
import {
  createScreenPoint,
  projectWorldPointToScreen,
} from '../geometry/projectWorldPointToScreen';

interface CityLabelValue {
  element: HTMLElement;
  isVisible: boolean;
  worldPoint: { x: number; y: number; z: number };
  x: number;
  y: number;
}

interface NetworkCityLabelsProps {
  cities: readonly NetworkSceneCityValue[];
}

const MOVE_EPSILON_PX = 0.01;

const LAYER_CLASS_NAME = 'pointer-events-none absolute inset-0 overflow-hidden';

const LABEL_CLASS_NAME = [
  'absolute top-0 left-0 -translate-x-1/2 -translate-y-[calc(100%+4px)] select-none',
  'rounded-control border border-line bg-panel-solid px-2 py-0.5 shadow-panel',
  'text-xs leading-4 font-semibold whitespace-nowrap text-on-panel',
].join(' ');

const createCityLabel = (city: NetworkSceneCityValue): CityLabelValue => {
  const element = document.createElement('div');

  element.className = LABEL_CLASS_NAME;
  element.textContent = city.name;
  element.style.display = 'none';

  return {
    element,
    isVisible: false,
    worldPoint: { x: city.x, y: CITY_LABEL_HEIGHT_METERS, z: city.z },
    x: Number.POSITIVE_INFINITY,
    y: Number.POSITIVE_INFINITY,
  };
};

export const NetworkCityLabels = ({ cities }: NetworkCityLabelsProps): null | ReactElement => {
  const canvas = useThree(state => state.gl.domElement);
  const invalidate = useThree(state => state.invalidate);

  const labelsRef = useRef<readonly CityLabelValue[]>([]);
  const screenPointRef = useRef<ScreenPointValue>(createScreenPoint());

  useFrame(({ camera, size }) => {
    const labels = labelsRef.current;
    const screenPoint = screenPointRef.current;

    if (labels.length === 0) {
      return;
    }

    camera.updateMatrixWorld();

    for (const label of labels) {
      projectWorldPointToScreen(label.worldPoint, camera, size, screenPoint);

      if (screenPoint.isVisible !== label.isVisible) {
        label.isVisible = screenPoint.isVisible;
        label.element.style.display = screenPoint.isVisible ? '' : 'none';
      }

      const isMoved = Math.abs(screenPoint.x - label.x) > MOVE_EPSILON_PX || Math.abs(screenPoint.y - label.y) > MOVE_EPSILON_PX;

      if (isMoved) {
        label.x = screenPoint.x;
        label.y = screenPoint.y;
        label.element.style.transform = `translate3d(${screenPoint.x.toFixed(2)}px,${screenPoint.y.toFixed(2)}px,0)`;
      }
    }
  });

  useLayoutEffect(() => {
    const host = canvas.parentElement;

    if (host === null) {
      return undefined;
    }

    const layer = document.createElement('div');
    const labels = cities.map(createCityLabel);

    layer.className = LAYER_CLASS_NAME;
    layer.append(...labels.map(label => label.element));
    host.append(layer);
    labelsRef.current = labels;
    invalidate();

    return (): void => {
      labelsRef.current = [];
      layer.remove();
    };
  }, [canvas, cities, invalidate]);

  return null;
};
