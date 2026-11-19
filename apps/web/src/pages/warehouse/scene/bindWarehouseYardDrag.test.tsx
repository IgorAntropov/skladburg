import {
  BoxGeometry,
  Group,
  InstancedMesh,
  Matrix4,
  MeshBasicMaterial,
  OrthographicCamera,
  Scene,
} from 'three';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import type {
  IWarehouseYardDragBinding,
  WarehouseYardDragContextValue,
} from './bindWarehouseYardDrag';

import { bindWarehouseYardDrag } from './bindWarehouseYardDrag';
import { createWarehouseYardMotion } from './warehouseYardMotion';

const POINT_AVAILABLE = 50;
const POINT_UNAVAILABLE = 80;
const POINT_DOCK = 140;
const POINT_OUTSIDE = 180;
const TASK = 'visit';
const DOCK = 'target';
const POINTER_ID = 1;

const sendPointer = (canvas: HTMLCanvasElement, type: string, x: number): boolean =>
  canvas.dispatchEvent(new PointerEvent(type, {
    bubbles: true, button: 0, cancelable: true, clientX: x, clientY: 100, isPrimary: true, pointerId: POINTER_ID, pointerType: 'touch',
  }));

describe('bindWarehouseYardDrag', () => {
  let root: HTMLDivElement;
  let canvas: HTMLCanvasElement;
  let binding: IWarehouseYardDragBinding;
  let context: WarehouseYardDragContextValue;
  let elementFromPoint: PropertyDescriptor | undefined;
  const onDockDrop = vi.fn();
  const onGrabChange = vi.fn();
  const releasePointerCapture = vi.fn();
  const setPointerCapture = vi.fn();
  const onCameraDown = vi.fn();
  const geometry = new BoxGeometry(1, 1, 1);
  const material = new MeshBasicMaterial();

  beforeEach(() => {
    root = document.createElement('div');
    canvas = document.createElement('canvas');
    canvas.style.cursor = 'auto';
    root.append(canvas);
    document.body.append(root);
    root.addEventListener('pointerdown', onCameraDown);
    elementFromPoint = Object.getOwnPropertyDescriptor(document, 'elementFromPoint');
    Object.defineProperty(document, 'elementFromPoint', {
      configurable: true,
      value: (x: number): HTMLElement => x === POINT_OUTSIDE ? root : canvas,
    });
    Object.defineProperties(canvas, {
      getBoundingClientRect: { value: (): DOMRect => DOMRect.fromRect({ height: 200, width: 200 }) },
      hasPointerCapture: { value: (): boolean => true },
      releasePointerCapture: { value: releasePointerCapture },
      setPointerCapture: { value: setPointerCapture },
    });

    const camera = new OrthographicCamera(-10, 10, 10, -10, 0.1, 100);
    camera.position.set(0, 10, 0);
    camera.up.set(0, 0, -1);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();
    const scene = new Scene();
    const parking = new Group();
    parking.name = 'warehouse-yard-parking';
    const trucks = new InstancedMesh(geometry, material, 2);
    trucks.setMatrixAt(0, new Matrix4().makeTranslation(-5, 0.5, 0));
    trucks.setMatrixAt(1, new Matrix4().makeTranslation(-2, 0.5, 0));
    parking.add(trucks);
    scene.add(parking);
    scene.updateMatrixWorld();

    const yard = createWarehouseYardMotion();
    const [available, unavailable] = yard.pool;
    if (available === undefined || unavailable === undefined) {
      throw new Error('Expected two parking places');
    }
    available.taskId = TASK;
    unavailable.taskId = 'unavailable';
    yard.parked.push(available, unavailable);
    yard.byTask.set(TASK, available);
    context = {
      docks: [{ id: DOCK, x: 4, z: 3 }],
      drag: { onDockDrop, options: new Map([[TASK, { taskVersion: 3, unloadingPointIds: [DOCK] }]]) },
    };
    binding = bindWarehouseYardDrag({
      canvas, getContext: () => context, getScene: () => ({ camera, scene }), onGrabChange, onHoverChange: vi.fn(), root, yard,
    });
  });

  afterEach(() => {
    binding.dispose();
    root.remove();
    if (elementFromPoint === undefined) {
      Reflect.deleteProperty(document, 'elementFromPoint');
    }
    else {
      Object.defineProperty(document, 'elementFromPoint', elementFromPoint);
    }
    vi.clearAllMocks();
  });

  it('captures only an eligible visual instance and returns a dock selection on release', () => {
    expect(sendPointer(canvas, 'pointerdown', POINT_UNAVAILABLE)).toBe(true);
    expect(onCameraDown).toHaveBeenCalledTimes(1);
    expect(setPointerCapture).not.toHaveBeenCalled();
    expect(sendPointer(canvas, 'pointerdown', POINT_AVAILABLE)).toBe(false);
    expect(onCameraDown).toHaveBeenCalledTimes(1);
    expect(setPointerCapture).toHaveBeenCalledWith(POINTER_ID);
    expect(sendPointer(canvas, 'pointerup', POINT_DOCK)).toBe(false);
    expect(releasePointerCapture).toHaveBeenCalledWith(POINTER_ID);
    expect(canvas.style.cursor).toBe('auto');
    expect(onDockDrop).toHaveBeenCalledExactlyOnceWith({ taskId: TASK, taskVersion: 3, unloadingPointId: DOCK });
  });

  it('releases the gesture for cancellation, a miss, and changed server options', () => {
    sendPointer(canvas, 'pointerdown', POINT_AVAILABLE);
    sendPointer(canvas, 'pointercancel', POINT_DOCK);
    sendPointer(canvas, 'pointerdown', POINT_AVAILABLE);
    sendPointer(canvas, 'pointerup', POINT_OUTSIDE);
    sendPointer(canvas, 'pointerdown', POINT_AVAILABLE);
    context = { ...context, drag: { ...context.drag, options: new Map() } };
    binding.sync();
    expect(onGrabChange).toHaveBeenLastCalledWith(undefined);
    expect(releasePointerCapture).toHaveBeenCalledTimes(3);
    expect(onDockDrop).not.toHaveBeenCalled();
    expect(sendPointer(canvas, 'pointerdown', POINT_AVAILABLE)).toBe(true);
    expect(onCameraDown).toHaveBeenCalledTimes(1);
  });
});
