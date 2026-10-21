import type { Camera } from 'three';

import type {
  NetworkMapTargetValue,
  NetworkSceneInteractionValue,
} from '../../model/networkSceneInteraction';
import type { ScreenSizeValue } from '../geometry/projectWorldPointToScreen';
import type { PointerSampleValue } from './isTapGesture';
import type { PickTargetsValue } from './projectPickCandidates';

import { isTapGesture } from './isTapGesture';
import {
  pickNetworkObject,
  resolveCaptureRadius,
} from './pickNetworkObject';
import {
  createPickCandidates,
  projectPickCandidates,
} from './projectPickCandidates';

export interface NetworkPointerPickerOptionsValue {
  element: HTMLElement;
  getInteraction: () => NetworkSceneInteractionValue | undefined;
  getView: () => PointerPickerViewValue;
  targets: PickTargetsValue;
}

export interface PointerPickerViewValue {
  camera: Camera;
  size: ScreenSizeValue;
}

const LISTENER_OPTIONS = { passive: true } as const;

const POINTER_CURSOR = 'pointer';

const createSample = (event: PointerEvent): PointerSampleValue => ({
  button: event.button,
  pointerId: event.pointerId,
  pointerType: event.pointerType,
  x: event.clientX,
  y: event.clientY,
});

export const createNetworkPointerPicker = (options: NetworkPointerPickerOptionsValue): (() => void) => {
  const { element, getInteraction, getView, targets } = options;
  const candidates = createPickCandidates(targets);
  const activePointerIds = new Set<number>();
  let downSample: PointerSampleValue | undefined;
  let hoveredId: string | undefined;

  const pickAt = (event: PointerEvent): NetworkMapTargetValue | undefined => {
    const { camera, size } = getView();
    const bounds = element.getBoundingClientRect();

    projectPickCandidates(targets, camera, size, candidates);

    return pickNetworkObject(
      { x: event.clientX - bounds.left, y: event.clientY - bounds.top },
      candidates,
      resolveCaptureRadius(event.pointerType),
    );
  };

  const setHoveredId = (nextId: string | undefined): void => {
    if (nextId === hoveredId) {
      return;
    }

    const interaction = getInteraction();

    if (hoveredId !== undefined) {
      interaction?.onHoverEnd(hoveredId);
    }

    hoveredId = nextId;

    if (nextId !== undefined) {
      interaction?.onHoverStart(nextId);
    }

    element.style.cursor = nextId === undefined ? '' : POINTER_CURSOR;
  };

  const handlePointerDown = (event: PointerEvent): void => {
    if (event.isPrimary) {
      activePointerIds.clear();
    }

    activePointerIds.add(event.pointerId);
    downSample = activePointerIds.size > 1 ? undefined : createSample(event);
  };

  const handlePointerUp = (event: PointerEvent): void => {
    const down = downSample;

    activePointerIds.delete(event.pointerId);
    downSample = undefined;

    if (down === undefined || !isTapGesture(down, createSample(event))) {
      return;
    }

    const target = pickAt(event);

    console.log('> createNetworkPointerPicker -> handlePointerUp:', { pointerType: event.pointerType, target });

    if (target !== undefined) {
      getInteraction()?.onSelect(target);
    }
  };

  const handlePointerCancel = (event: PointerEvent): void => {
    activePointerIds.delete(event.pointerId);
    downSample = undefined;
  };

  const handlePointerMove = (event: PointerEvent): void => {
    if (event.pointerType !== 'mouse' || event.buttons !== 0) {
      return;
    }

    setHoveredId(pickAt(event)?.id);
  };

  const handlePointerLeave = (event: PointerEvent): void => {
    if (event.pointerType === 'mouse') {
      setHoveredId(undefined);
    }
  };

  element.addEventListener('pointerdown', handlePointerDown, LISTENER_OPTIONS);
  element.addEventListener('pointerup', handlePointerUp, LISTENER_OPTIONS);
  element.addEventListener('pointercancel', handlePointerCancel, LISTENER_OPTIONS);
  element.addEventListener('pointermove', handlePointerMove, LISTENER_OPTIONS);
  element.addEventListener('pointerleave', handlePointerLeave, LISTENER_OPTIONS);

  return (): void => {
    element.removeEventListener('pointerdown', handlePointerDown);
    element.removeEventListener('pointerup', handlePointerUp);
    element.removeEventListener('pointercancel', handlePointerCancel);
    element.removeEventListener('pointermove', handlePointerMove);
    element.removeEventListener('pointerleave', handlePointerLeave);
    setHoveredId(undefined);
  };
};
