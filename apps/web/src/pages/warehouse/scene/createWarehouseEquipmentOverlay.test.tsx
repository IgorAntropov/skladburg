import { WarehouseEquipmentStatus } from '@skladburg/contracts/wms/v1/warehouse_equipment';
import { WarehouseStaffWorkRole } from '@skladburg/contracts/wms/v1/warehouse_staff_profile';
import { OrthographicCamera } from 'three';
import {
  expect,
  it,
  vi,
} from 'vitest';

import type { WarehouseSceneEquipmentValue } from '../model/warehouseSceneInteraction';
import type { WarehouseStaffLabelBoundsValue } from './createWarehouseStaffOverlay';
import type { WarehouseEquipmentActorValue } from './warehouseEquipmentMotion';

import { createWarehouseEquipmentOverlay } from './createWarehouseEquipmentOverlay';
import { createWarehouseStaffOverlay } from './createWarehouseStaffOverlay';

const actor = (id: string): WarehouseEquipmentActorValue => {
  const pose = { lift: 0, reach: 0, x: 0, yaw: 0, z: 0 };
  return {
    cargoJob: undefined, cargoLane: -1, isCatchingUp: false, needsRoute: false, nextCargoLane: -1, path: [], pose, step: 0, target: pose,
    unit: { badge: id, id, label: id + ' 18%', status: WarehouseEquipmentStatus.CHARGING, statusLabel: 'Charging' },
  };
};

it('keeps equipment badges clear of staff counters, preserves the keyboard trigger on refresh, and clears a released bay', () => {
  const canvas = document.createElement('canvas');
  const host = document.createElement('div');
  document.body.append(host);
  const overlay = createWarehouseEquipmentOverlay(canvas, host);
  try {
    const first = actor('unit-a');
    const second = actor('unit-b');
    const actors = new Map([[first.unit.id, first], [second.unit.id, second]]);
    const bays = [{ cabinet: { x: 0, z: 0 }, parking: first.pose, stationId: 'station' }];
    const fleet: WarehouseSceneEquipmentValue = {
      stations: [{ equipmentId: 'unit-a', id: 'station', label: 'station' }], units: [first.unit, second.unit],
    };
    const select = vi.fn();
    overlay.update(actors, bays, fleet, select);
    const buttons = Array.from(host.querySelectorAll('button'));
    const station = host.querySelector('span');
    const firstButton = buttons[0];
    if (station === null || firstButton === undefined) {
      throw new Error('Missing projected labels');
    }
    expect(buttons).toHaveLength(2);
    const nodes = [...buttons, station];
    for (const element of nodes) {
      Object.defineProperties(element, { offsetHeight: { value: 22 }, offsetWidth: { value: 80 } });
    }
    const camera = new OrthographicCamera(-3, 3, 3, -3, 0.1, 10);
    camera.position.z = 6;
    camera.updateMatrixWorld();
    overlay.project(camera, 360, 280, [{ labelHeight: 20, labelWidth: 80, screenX: 180, screenY: 92 }]);
    const offsets = nodes.map(element => Number(/,(-?\d+)px\)/.exec(element.style.transform)?.[1])).toSorted((left, right) => left - right);
    for (const [index, top] of offsets.entries()) {
      expect(top >= 93 || top + 22 < 72).toBe(true);
      const previous = offsets[index - 1];
      if (previous !== undefined) {
        expect(top).toBeGreaterThan(previous + 22);
      }
    }
    expect(firstButton.textContent).toContain('Charging');
    expect(firstButton.getAttribute('aria-label')).toBe('unit-a 18%');
    expect(station.dataset.equipmentId).toBe('unit-a');
    firstButton.focus();
    firstButton.click();
    expect(select).toHaveBeenCalledWith('unit-a', firstButton);
    overlay.update(actors, bays, { ...fleet, stations: [{ id: 'station', label: 'available' }] }, select);
    expect(document.activeElement).toBe(firstButton);
    expect(station.dataset.equipmentId).toBeUndefined();
    overlay.update(new Map(), [], { stations: [], units: [] }, select);
    expect(host.querySelector('button')).toBeNull();
  }
  finally {
    overlay.dispose();
    host.remove();
  }
});

it.each([true, false])('reserves the avatar touch area and picks the nearest actor regardless of mount order (%s)', (isStaffFirst) => {
  const canvas = document.createElement('canvas');
  const host = document.createElement('div');
  host.append(canvas);
  document.body.append(host);
  const bounds: { current: readonly WarehouseStaffLabelBoundsValue[] } = { current: [] };
  const [staff, equipment] = isStaffFirst
    ? [createWarehouseStaffOverlay(canvas, host, bounds), createWarehouseEquipmentOverlay(canvas, host)] as const
    : (() => {
        const overlay = createWarehouseEquipmentOverlay(canvas, host);
        return [createWarehouseStaffOverlay(canvas, host, bounds), overlay] as const;
      })();
  try {
    const selectStaff = vi.fn();
    const selectEquipment = vi.fn();
    const unit = actor('forklift');
    unit.pose.x = 0.12;
    staff.update({
      actors: [{
        areaId: 'area', avatarKey: 'picker', displayName: 'Worker', staffId: 'w', workRole: WarehouseStaffWorkRole.PICKER, x: 0, z: 0,
      }],
      floor: new Map(),
      markers: [],
    }, { formatStaffOverflow: undefined, onStaffSelect: selectStaff, selectedStaffId: undefined });
    equipment.update(new Map([['forklift', unit]]), [], { stations: [], units: [unit.unit] }, selectEquipment);
    const label = host.querySelector('[data-testid="warehouse-scene-equipment-forklift"]');
    if (!(label instanceof HTMLButtonElement)) {
      throw new Error('Missing forklift label');
    }
    Object.defineProperties(label, { offsetHeight: { value: 38 }, offsetWidth: { value: 90 } });
    const camera = new OrthographicCamera(-2, 2, 2, -2, 0.1, 10);
    camera.position.z = 6;
    camera.updateMatrixWorld();
    staff.project(camera, 200, 200);
    equipment.project(camera, 200, 200, bounds.current);
    const top = Number(/,(-?\d+)px\)/.exec(label.style.transform)?.[1]);
    expect(top + 38 <= 31 || top >= 75).toBe(true);

    const tap = (x: number, y: number): void => {
      const init = { bubbles: true, button: 0, clientX: x, clientY: y, isPrimary: true, pointerId: 1, pointerType: 'touch' };
      canvas.dispatchEvent(new PointerEvent('pointerdown', init));
      canvas.dispatchEvent(new PointerEvent('pointerup', init));
      canvas.dispatchEvent(new MouseEvent('click', { bubbles: true, button: 0 }));
    };
    tap(100, 69);
    expect(selectStaff).toHaveBeenCalledExactlyOnceWith('w');
    expect(selectEquipment).not.toHaveBeenCalled();
    tap(106, 82);
    expect(selectEquipment).toHaveBeenCalledExactlyOnceWith('forklift', label);
    expect(selectStaff).toHaveBeenCalledTimes(1);
  }
  finally {
    equipment.dispose();
    staff.dispose();
    host.remove();
  }
});
