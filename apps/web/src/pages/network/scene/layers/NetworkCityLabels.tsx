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
import { resolveCityLabelState } from '../geometry/resolveCityLabelState';

interface CityLabelStatesValue {
  hoveredId: string | undefined;
  hoveredSiteIds: readonly string[];
  selectedIds: readonly string[];
}

interface CityLabelValue {
  city: NetworkSceneCityValue;
  element: HTMLElement;
  isVisible: boolean;
  worldPoint: { x: number; y: number; z: number };
  x: number;
  y: number;
}

interface NetworkCityLabelsProps {
  cities: readonly NetworkSceneCityValue[];
  hoveredId: string | undefined;
  hoveredSiteIds: readonly string[];
  selectedIds: readonly string[];
}

const MOVE_EPSILON_PX = 0.01;

const LAYER_CLASS_NAME = 'pointer-events-none absolute inset-0 overflow-hidden';

const LABEL_CLASS_NAME = [
  'absolute top-0 left-0 -translate-x-1/2 -translate-y-[calc(100%+4px)] select-none',
  'rounded-control border border-line bg-panel-solid px-2 py-0.5 shadow-panel',
  'text-xs leading-4 font-semibold whitespace-nowrap text-on-panel',
  'data-[hovered=true]:border-indicator',
  'data-[selected=true]:border-indicator data-[selected=true]:ring-1 data-[selected=true]:ring-indicator data-[selected=true]:ring-inset',
].join(' ');

const MORE_CLASS_NAME = [
  'ml-1.5 inline-block rounded-full bg-hover px-1.5',
  'text-xs leading-4 font-medium tabular-nums text-on-panel-muted',
].join(' ');

const setBooleanAttribute = (element: HTMLElement, name: string, isOn: boolean): void => {
  if (isOn) {
    element.setAttribute(name, 'true');
  }
  else {
    element.removeAttribute(name);
  }
};

const applyCityLabelStates = (labels: readonly CityLabelValue[], states: CityLabelStatesValue): void => {
  for (const label of labels) {
    const { isHovered, isSelected } = resolveCityLabelState(
      label.city,
      states.hoveredId,
      states.hoveredSiteIds,
      states.selectedIds,
    );

    setBooleanAttribute(label.element, 'data-hovered', isHovered);
    setBooleanAttribute(label.element, 'data-selected', isSelected);
  }
};

const createCityLabel = (city: NetworkSceneCityValue): CityLabelValue => {
  const element = document.createElement('div');
  const name = document.createElement('span');

  element.className = LABEL_CLASS_NAME;
  element.dataset.testid = 'network-city-label';
  element.dataset.cityId = city.id;
  element.style.display = 'none';
  name.textContent = city.name;
  element.append(name);

  if (city.hiddenSiteIds.length > 0) {
    const more = document.createElement('span');

    more.className = MORE_CLASS_NAME;
    more.dataset.testid = 'network-city-label-more';
    more.textContent = `+${String(city.hiddenSiteIds.length)}`;
    element.append(more);
  }

  return {
    city,
    element,
    isVisible: false,
    worldPoint: { x: city.x, y: CITY_LABEL_HEIGHT_METERS, z: city.z },
    x: Number.POSITIVE_INFINITY,
    y: Number.POSITIVE_INFINITY,
  };
};

export const NetworkCityLabels = ({
  cities,
  hoveredId,
  hoveredSiteIds,
  selectedIds,
}: NetworkCityLabelsProps): null | ReactElement => {
  const canvas = useThree(state => state.gl.domElement);
  const invalidate = useThree(state => state.invalidate);

  const labelsRef = useRef<readonly CityLabelValue[]>([]);
  const screenPointRef = useRef<ScreenPointValue>(createScreenPoint());
  const statesRef = useRef<CityLabelStatesValue>({ hoveredId, hoveredSiteIds, selectedIds });

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
    applyCityLabelStates(labels, statesRef.current);
    invalidate();

    return (): void => {
      labelsRef.current = [];
      layer.remove();
    };
  }, [canvas, cities, invalidate]);

  useLayoutEffect(() => {
    statesRef.current = { hoveredId, hoveredSiteIds, selectedIds };
    applyCityLabelStates(labelsRef.current, statesRef.current);
  }, [cities, hoveredId, hoveredSiteIds, selectedIds]);

  return null;
};
