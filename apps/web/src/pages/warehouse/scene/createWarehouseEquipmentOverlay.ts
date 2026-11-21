import type { Camera } from 'three';

import { Vector3 } from 'three';

import type {
  WarehouseSceneEquipmentValue,
  WarehouseSceneInteractionValue,
} from '../model/warehouseSceneInteraction';
import type { WarehouseStaffLabelBoundsValue } from './createWarehouseStaffOverlay';
import type {
  WarehouseEquipmentActorValue,
  WarehouseEquipmentBayValue,
} from './warehouseEquipmentMotion';

import { bindWarehouseActorPicking } from './bindWarehouseActorPicking';

interface EquipmentMarkerValue {
  anchor: { x: number; z: number };
  element: HTMLElement;
  height: number;
  left: number;
  screenX: number;
  screenY: number;
  top: number;
  width: number;
}

interface EquipmentOverlayValue {
  dispose: () => void;
  project: (camera: Camera, width: number, height: number, staffBounds: readonly WarehouseStaffLabelBoundsValue[]) => void;
  update: (
    actors: Map<string, WarehouseEquipmentActorValue>, bays: readonly WarehouseEquipmentBayValue[],
    fleet: WarehouseSceneEquipmentValue, onSelect: WarehouseSceneInteractionValue['onEquipmentSelect'],
  ) => void;
}

const BADGE = [
  'absolute left-0 top-0 rounded-control border border-line bg-panel-solid px-1.5 py-0.5',
  'text-xs font-semibold leading-4 text-on-panel tabular-nums shadow-panel',
].join(' ');

const findMarkerTop = (
  marker: EquipmentMarkerValue, left: number, anchor: number, height: number,
  staff: readonly WarehouseStaffLabelBoundsValue[], placed: readonly EquipmentMarkerValue[],
): number => {
  const limit = Math.max(0, height - marker.height);
  const start = Math.max(0, Math.min(limit, anchor));
  let above = start;
  let below = start;
  for (let pass = 0; pass <= staff.length + placed.length; pass += 1) {
    const lastAbove = above;
    const lastBelow = below;
    for (let index = 0; index < staff.length + placed.length; index += 1) {
      const count = staff[index];
      const other = placed[index - staff.length];
      const width = count?.labelWidth ?? other?.width ?? 0;
      const leftEdge = count === undefined ? other?.left ?? 0 : count.screenX - width / 2;
      if (left >= leftEdge + width + 2 || left + marker.width + 2 <= leftEdge) {
        continue;
      }
      const bottom = count?.screenY ?? (other === undefined ? 0 : other.top + other.height);
      const top = bottom - (count?.labelHeight ?? other?.height ?? 0);
      if (above < bottom + 2 && above + marker.height + 2 > top) {
        above = Math.floor(top - marker.height - 3);
      }
      if (below < bottom + 2 && below + marker.height + 2 > top) {
        below = Math.ceil(bottom + 3);
      }
    }
    if (above === lastAbove && below === lastBelow) {
      break;
    }
  }
  if (above >= 0 && (below > limit || start - above <= below - start)) {
    return above;
  }
  return below <= limit ? below : start;
};

export const createWarehouseEquipmentOverlay = (canvas: HTMLCanvasElement, host: HTMLElement): EquipmentOverlayValue => {
  const layer = document.createElement('div');
  layer.className = 'pointer-events-none absolute inset-0 overflow-hidden select-none';
  host.append(layer);
  const markers = new Map<string, EquipmentMarkerValue>();
  const placed: EquipmentMarkerValue[] = [];
  const point = new Vector3();
  const unbind = bindWarehouseActorPicking(canvas, (x, y, radius) => {
    let distance = radius * radius;
    let result: HTMLButtonElement | undefined;
    for (const { element, screenX, screenY } of markers.values()) {
      if (!(element instanceof HTMLButtonElement) || element.hidden || element.disabled) {
        continue;
      }
      const delta = (screenX - x) ** 2 + (screenY - y) ** 2;
      if (delta <= distance) {
        result = element;
        distance = delta;
      }
    }
    return result === undefined ? undefined : { button: result, distanceSq: distance };
  });

  const updateMarker = (id: string, anchor: EquipmentMarkerValue['anchor'], label: string, isUnit: boolean): HTMLElement => {
    let marker = markers.get(id);
    if (marker === undefined) {
      const element = document.createElement(isUnit ? 'button' : 'span');
      element.className = isUnit
        ? BADGE + ' pointer-events-auto cursor-pointer whitespace-pre focus-visible:outline-2 focus-visible:outline-focus'
        : BADGE + ' border-dashed whitespace-nowrap';
      element.hidden = true;
      element.dataset.testid = (isUnit ? 'warehouse-scene-equipment-' : 'warehouse-scene-station-') + id;
      marker = { anchor, element, height: 0, left: NaN, screenX: NaN, screenY: NaN, top: NaN, width: 0 };
      markers.set(id, marker);
      layer.append(element);
    }
    marker.anchor = anchor;
    if (marker.element.textContent !== label) {
      marker.element.textContent = label;
      marker.width = 0;
    }
    return marker.element;
  };

  return {
    dispose: (): void => {
      unbind();
      layer.remove();
      markers.clear();
    },
    project: (camera, width, height, staffBounds): void => {
      placed.length = 0;
      for (const marker of markers.values()) {
        const { anchor, element } = marker;
        const isUnit = element instanceof HTMLButtonElement;
        point.set(anchor.x, isUnit ? 0.36 : 1.15, anchor.z).project(camera);
        const hidden = Math.abs(point.x) > 1 || Math.abs(point.y) > 1 || Math.abs(point.z) > 1;
        if (element.hidden !== hidden) {
          element.hidden = hidden;
        }
        if (hidden) {
          continue;
        }
        marker.screenX = (point.x + 1) * width / 2;
        marker.screenY = (1 - point.y) * height / 2;
        if (marker.width === 0) {
          marker.width = element.offsetWidth;
          marker.height = element.offsetHeight;
        }
        point.set(anchor.x, isUnit ? 1.12 : 1.15, anchor.z).project(camera);
        const left = Math.round(Math.max(0, Math.min(width - marker.width, marker.screenX - marker.width / 2)));
        const anchorTop = (1 - point.y) * height / 2 - (isUnit ? marker.height + 2 : -3);
        const top = findMarkerTop(marker, left, Math.round(anchorTop), height, staffBounds, placed);
        if (left !== marker.left || top !== marker.top) {
          marker.left = left;
          marker.top = top;
          element.style.transform = `translate(${String(left)}px,${String(top)}px)`;
        }
        placed.push(marker);
      }
    },
    update: (actors, bays, fleet, onSelect): void => {
      const retained = new Set<string>();
      for (const [id, actor] of actors) {
        retained.add(id);
        const { badge, label, statusLabel } = actor.unit;
        const text = badge + '\n' + statusLabel;
        const element = updateMarker(id, actor.pose, text, true);
        element.setAttribute('aria-label', label);
        element.title = label;
        if (element instanceof HTMLButtonElement) {
          element.type = 'button';
          element.setAttribute('aria-haspopup', 'dialog');
          element.disabled = onSelect === undefined;
          element.onclick = (): void => onSelect?.(id, element);
        }
      }
      for (const bay of bays) {
        const station = fleet.stations.find(current => current.id === bay.stationId);
        if (station !== undefined) {
          retained.add(station.id);
          const element = updateMarker(station.id, bay.cabinet, station.label, false);
          if (station.equipmentId === undefined) {
            delete element.dataset.equipmentId;
          }
          else {
            element.dataset.equipmentId = station.equipmentId;
          }
        }
      }
      for (const [id, { element }] of markers) {
        if (!retained.has(id)) {
          markers.delete(id);
          element.remove();
        }
      }
    },
  };
};
