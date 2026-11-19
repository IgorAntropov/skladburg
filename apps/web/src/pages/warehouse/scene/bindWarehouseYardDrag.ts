import type { RootState } from '@react-three/fiber';
import type { Intersection } from 'three';

import {
  InstancedMesh,
  Plane,
  Raycaster,
  Vector2,
  Vector3,
} from 'three';

import type { WarehouseYardDragValue } from '../model/warehouseYardDockChoice';
import type { WarehouseDockLayoutValue } from './warehouseLayout';
import type { WarehouseYardGrabValue } from './warehouseYardDrag';
import type { WarehouseYardMotionValue } from './warehouseYardMotion';

import {
  beginWarehouseYardGrab,
  findWarehouseYardDockTarget,
  readWarehouseYardDrop,
  readWarehouseYardGrabDocks,
  WAREHOUSE_YARD_TARGET_HEIGHT,
} from './warehouseYardDrag';

export interface IWarehouseYardDragBinding {
  dispose: () => void;
  sync: () => void;
}

export interface WarehouseYardDragContextValue {
  docks: readonly WarehouseDockLayoutValue[];
  drag: WarehouseYardDragValue;
}

interface WarehouseYardDragBindingOptionsValue {
  canvas: HTMLCanvasElement;
  getContext: () => WarehouseYardDragContextValue;
  getScene: () => Pick<RootState, 'camera' | 'scene'>;
  onGrabChange: (grab: undefined | WarehouseYardGrabValue) => void;
  onHoverChange: (dockId: string | undefined) => void;
  root: HTMLElement;
  yard: WarehouseYardMotionValue;
}

const stopPointerEvent = (event: Event): void => {
  event.preventDefault();
  event.stopImmediatePropagation();
};

export const bindWarehouseYardDrag = ({
  canvas, getContext, getScene, onGrabChange, onHoverChange, root, yard,
}: WarehouseYardDragBindingOptionsValue): IWarehouseYardDragBinding => {
  const raycaster = new Raycaster();
  const pointer = new Vector2();
  const apron = new Plane(new Vector3(0, 1, 0), -WAREHOUSE_YARD_TARGET_HEIGHT);
  const groundPoint = new Vector3();
  const intersections: Intersection[] = [];
  const document = canvas.ownerDocument;
  const view = document.defaultView;
  let grab: undefined | WarehouseYardGrabValue;
  let prevCursor = '';
  let shouldSuppressClick = false;

  const releaseGrab = (shouldRedraw: boolean): void => {
    const current = grab;
    if (current === undefined) {
      return;
    }
    grab = undefined;
    if (canvas.hasPointerCapture(current.pointerId)) {
      canvas.releasePointerCapture(current.pointerId);
    }
    canvas.style.cursor = prevCursor;
    if (shouldRedraw) {
      onGrabChange(undefined);
      onHoverChange(undefined);
    }
  };

  const setRay = ({ clientX, clientY }: PointerEvent): boolean => {
    if (document.elementFromPoint(clientX, clientY) !== canvas) {
      return false;
    }
    const { height, left, top, width } = canvas.getBoundingClientRect();
    if (width === 0 || height === 0) {
      return false;
    }
    pointer.set((clientX - left) / width * 2 - 1, 1 - (clientY - top) / height * 2);
    raycaster.setFromCamera(pointer, getScene().camera);
    return true;
  };

  const pickDock = (event: PointerEvent): string | undefined =>
    setRay(event) && raycaster.ray.intersectPlane(apron, groundPoint) !== null
      ? findWarehouseYardDockTarget(getContext().docks, groundPoint)
      : undefined;

  const handlePointerDown = (event: PointerEvent): void => {
    if (grab !== undefined) {
      releaseGrab(true);
      return;
    }
    shouldSuppressClick = false;
    if (event.button !== 0 || !event.isPrimary || !setRay(event)) {
      return;
    }
    const parkedTrucks = getScene().scene.getObjectByName('warehouse-yard-parking')?.children[0];
    if (!(parkedTrucks instanceof InstancedMesh)) {
      return;
    }
    intersections.length = 0;
    raycaster.intersectObject(parkedTrucks, false, intersections);
    const current = beginWarehouseYardGrab(yard.parked, intersections[0]?.instanceId, getContext().drag.options, event);
    intersections.length = 0;
    if (current === undefined) {
      return;
    }
    stopPointerEvent(event);
    canvas.setPointerCapture(event.pointerId);
    shouldSuppressClick = true;
    grab = current;
    prevCursor = canvas.style.cursor;
    canvas.style.cursor = 'grabbing';
    onGrabChange(current);
  };

  const handlePointerMove = (event: PointerEvent): void => {
    const current = grab;
    if (current?.pointerId !== event.pointerId) {
      return;
    }
    stopPointerEvent(event);
    if (!yard.byTask.has(current.taskId)) {
      releaseGrab(true);
      return;
    }
    const dockId = pickDock(event);
    const currentIds = readWarehouseYardGrabDocks(current, getContext().drag.options);
    onHoverChange(dockId !== undefined && currentIds?.includes(dockId) === true ? dockId : undefined);
  };

  const handlePointerUp = (event: PointerEvent): void => {
    const current = grab;
    if (current?.pointerId !== event.pointerId) {
      return;
    }
    stopPointerEvent(event);
    const { onDockDrop, options } = getContext().drag;
    const choice = yard.byTask.has(current.taskId) ? readWarehouseYardDrop(current, event, options, pickDock(event)) : undefined;
    releaseGrab(true);
    if (choice !== undefined) {
      onDockDrop(choice);
    }
  };

  const handlePointerCancel = (event: PointerEvent): void => {
    if (grab?.pointerId === event.pointerId) {
      releaseGrab(true);
    }
  };

  const handleClick = (event: MouseEvent): void => {
    if (shouldSuppressClick && event.target === canvas) {
      shouldSuppressClick = false;
      stopPointerEvent(event);
    }
  };

  const handleWheel = (event: WheelEvent): void => {
    if (grab !== undefined) {
      stopPointerEvent(event);
    }
  };

  const handleKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape' && grab !== undefined) {
      stopPointerEvent(event);
      releaseGrab(true);
    }
  };

  const handleBlur = (): void => {
    releaseGrab(true);
  };

  const handleVisibility = (): void => {
    if (document.hidden) {
      releaseGrab(true);
    }
  };

  root.addEventListener('pointerdown', handlePointerDown, true);
  root.addEventListener('pointermove', handlePointerMove, true);
  root.addEventListener('pointerup', handlePointerUp, true);
  root.addEventListener('pointercancel', handlePointerCancel, true);
  root.addEventListener('lostpointercapture', handlePointerCancel, true);
  root.addEventListener('click', handleClick, true);
  root.addEventListener('wheel', handleWheel, { capture: true, passive: false });
  view?.addEventListener('keydown', handleKeyDown, true);
  view?.addEventListener('blur', handleBlur);
  document.addEventListener('visibilitychange', handleVisibility);
  return {
    dispose: (): void => {
      root.removeEventListener('pointerdown', handlePointerDown, true);
      root.removeEventListener('pointermove', handlePointerMove, true);
      root.removeEventListener('pointerup', handlePointerUp, true);
      root.removeEventListener('pointercancel', handlePointerCancel, true);
      root.removeEventListener('lostpointercapture', handlePointerCancel, true);
      root.removeEventListener('click', handleClick, true);
      root.removeEventListener('wheel', handleWheel, true);
      view?.removeEventListener('keydown', handleKeyDown, true);
      view?.removeEventListener('blur', handleBlur);
      document.removeEventListener('visibilitychange', handleVisibility);
      releaseGrab(false);
    },
    sync: (): void => {
      if (grab !== undefined && readWarehouseYardGrabDocks(grab, getContext().drag.options) === undefined) {
        releaseGrab(true);
      }
    },
  };
};
