import { WarehouseStaffWorkRole } from '@skladburg/contracts/wms/v1/warehouse_staff_profile';
import { OrthographicCamera } from 'three';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import type { WarehouseStaffLayoutValue } from './warehouseStaffLayout';

import { createWarehouseStaffOverlay } from './createWarehouseStaffOverlay';

const placement: WarehouseStaffLayoutValue = {
  actors: [{
    areaId: 'area', avatarKey: 'picker', displayName: 'R', staffId: 'worker', workRole: WarehouseStaffWorkRole.PICKER, x: 0, z: 0,
  }],
  floor: new Map(),
  markers: [{ areaId: 'area', counter: { comparison: 'shortage', label: '1 of 3', text: '1/3' }, overflow: 2, x: 0, z: 0 }],
};
const selected = vi.fn();
const settings = {
  formatStaffOverflow: (count: number): string => `More ${String(count)}`,
  onStaffSelect: selected,
  selectedStaffId: undefined,
};
const camera = new OrthographicCamera(-2, 2, 2, -2, 0.1, 10);

describe('projected warehouse staff', () => {
  let root: HTMLElement;
  let canvas: HTMLCanvasElement;
  let overlay: ReturnType<typeof createWarehouseStaffOverlay>;
  const sendPointer = (type: string, x: number, pointerType = 'touch', isPrimary = true, y = 53): void => {
    canvas.dispatchEvent(new PointerEvent(type, {
      bubbles: true, button: 0, clientX: x, clientY: y, isPrimary, pointerId: isPrimary ? 1 : 2, pointerType,
    }));
  };
  const clickCanvas = (): void => {
    canvas.dispatchEvent(new MouseEvent('click', { bubbles: true, button: 0 }));
  };

  beforeEach(() => {
    root = document.createElement('div');
    canvas = document.createElement('canvas');
    const stage = document.createElement('div');
    stage.setAttribute('aria-hidden', 'true');
    stage.append(canvas);
    root.append(stage);
    document.body.append(root);
    selected.mockClear();
    camera.position.set(0, 0, 4);
    camera.rotation.set(0, 0, 0);
    camera.updateMatrixWorld();
    overlay = createWarehouseStaffOverlay(canvas, root);
    overlay.update(placement, settings);
    overlay.project(camera, 200, 200);
  });
  afterEach(() => {
    overlay.dispose();
    root.remove();
  });

  it('picks inside the touch radius while letting gestures reach the camera and retaining the focus target', () => {
    const cameraDown = vi.fn();
    const cellClick = vi.fn();
    canvas.addEventListener('pointerdown', cameraDown);
    canvas.addEventListener('click', cellClick);
    sendPointer('pointerdown', 120);
    sendPointer('pointerup', 120);
    clickCanvas();
    expect(cameraDown).toHaveBeenCalledOnce();
    expect(cellClick).not.toHaveBeenCalled();
    expect(selected).toHaveBeenCalledWith('worker');
    const button = root.querySelector('button');
    expect(document.activeElement).toBe(button);
    expect(button?.closest('[aria-hidden="true"]')).toBeNull();
    overlay.update(placement, { ...settings, selectedStaffId: 'worker' });
    expect(root.querySelector('button')).toBe(button);
    expect(root.querySelector('span')?.getAttribute('aria-label')).toBe('1 of 3. More 2');
  });

  it('hits the visible helmet with the mouse when the zoomed figure extends beyond the torso capture radius', () => {
    sendPointer('pointerdown', 100, 'mouse', true, 28);
    sendPointer('pointerup', 100, 'mouse', true, 28);
    clickCanvas();
    expect(selected).toHaveBeenCalledWith('worker');
  });

  it('keeps close counters readable on screen and retains the worker target at its projected location', () => {
    const markers = ['first', 'second', 'third'].map((areaId, index) => ({
      areaId, counter: { comparison: 'balanced' as const, label: areaId, text: areaId }, overflow: 0, x: index * 0.1, z: 0,
    }));
    overlay.update({ ...placement, markers }, settings);
    const labels = [...root.querySelectorAll('span')];
    for (const label of labels) {
      Object.defineProperty(label, 'offsetWidth', { value: 70 });
      Object.defineProperty(label, 'offsetHeight', { value: 20 });
    }
    overlay.project(camera, 200, 200);
    const bottoms = labels
      .map(label => Number(label.style.transform.split(',')[1]?.replace('px', '')))
      .sort((first, second) => first - second);
    expect(bottoms).toHaveLength(3);
    for (const [index, bottom] of bottoms.entries()) {
      expect(bottom).toBeGreaterThanOrEqual((bottoms[index - 1] ?? 0) + 20);
      expect(bottom).toBeLessThanOrEqual(200);
    }
    expect(root.querySelector('button')?.style.transform).toBe('translate3d(100.00px,53.00px,0)');
  });

  it('rejects a round-trip drag, a second finger, a cancelled gesture and a mouse outside its radius', () => {
    sendPointer('pointerdown', 100);
    sendPointer('pointermove', 115);
    sendPointer('pointerup', 100);
    clickCanvas();
    sendPointer('pointerdown', 100);
    sendPointer('pointerdown', 104, 'touch', false);
    sendPointer('pointerup', 100);
    clickCanvas();
    sendPointer('pointerdown', 100);
    sendPointer('pointercancel', 100);
    sendPointer('pointerup', 100);
    clickCanvas();
    sendPointer('pointerdown', 120, 'mouse');
    sendPointer('pointerup', 120, 'mouse');
    clickCanvas();
    expect(selected).not.toHaveBeenCalled();
  });

  it('reprojects on camera movement and removes stale personal targets while retaining an independent counter', () => {
    camera.rotation.y = Math.PI / 2;
    overlay.project(camera, 200, 200);
    expect(root.querySelector('button')?.hidden).toBe(true);
    sendPointer('pointerdown', 100);
    sendPointer('pointerup', 100);
    clickCanvas();
    expect(selected).not.toHaveBeenCalled();
    overlay.update({ ...placement, actors: [] }, settings);
    expect(root.querySelector('button')).toBeNull();
    expect(root.querySelector('span')).not.toBeNull();
    overlay.dispose();
    expect(root.children).toHaveLength(1);
  });
});
