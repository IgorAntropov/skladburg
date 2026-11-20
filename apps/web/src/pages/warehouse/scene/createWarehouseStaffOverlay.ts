import type { Camera } from 'three';

import {
  Matrix4,
  Vector3,
} from 'three';

import type { WarehouseSceneInteractionValue } from '../model/warehouseSceneInteraction';
import type {
  WarehouseStaffLayoutValue,
  WarehouseStaffMarkerValue,
} from './warehouseStaffLayout';

import { bindWarehouseStaffPicking } from './bindWarehouseStaffPicking';

interface ProjectedElementValue {
  element: HTMLElement;
  labelHeight: number;
  labelWidth: number;
  point: Vector3;
  screenX: number;
  screenY: number;
}

interface StaffOverlaySettingsValue {
  formatStaffOverflow: WarehouseSceneInteractionValue['formatStaffOverflow'];
  onStaffSelect: WarehouseSceneInteractionValue['onStaffSelect'];
  selectedStaffId: string | undefined;
}

interface StaffOverlayValue {
  dispose: () => void;
  project: (camera: Camera, width: number, height: number) => void;
  update: (layout: WarehouseStaffLayoutValue, settings: StaffOverlaySettingsValue) => void;
}

const COUNTER_CLASS = [
  'absolute left-0 top-0 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-control border border-line bg-panel-solid',
  'px-1.5 py-0.5 text-xs leading-4 font-semibold tabular-nums text-on-panel shadow-panel',
  'data-[comparison=shortage]:bg-status-warning data-[comparison=shortage]:text-on-status-warning',
  'data-[comparison=surplus]:border-indicator',
].join(' ');
const ACTOR_CLASS = [
  'pointer-events-none absolute left-0 top-0 size-11 -translate-x-1/2 -translate-y-1/2 rounded-full',
  'focus-visible:outline-2 focus-visible:outline-focus data-[selected=true]:ring-2 data-[selected=true]:ring-indicator',
].join(' ');
const MARK = { balanced: '=', shortage: '↓', surplus: '↑', unknown: '' };
const LABEL_GAP = 3;

const placeMarker = (marker: ProjectedElementValue, placed: ProjectedElementValue[], width: number, height: number): void => {
  const halfWidth = marker.labelWidth / 2;
  marker.screenX = Math.max(halfWidth, Math.min(width - halfWidth, marker.screenX));
  const anchor = Math.max(marker.labelHeight, Math.min(height, marker.screenY));
  let above = anchor;
  let below = anchor;
  for (let index = placed.length - 1; index >= 0; index -= 1) {
    const other = placed[index];
    if (other !== undefined && Math.abs(marker.screenX - other.screenX) < halfWidth + other.labelWidth / 2 + LABEL_GAP
      && above > other.screenY - other.labelHeight - LABEL_GAP && above - marker.labelHeight < other.screenY + LABEL_GAP) {
      above = other.screenY - other.labelHeight - LABEL_GAP;
    }
  }
  for (const other of placed) {
    if (Math.abs(marker.screenX - other.screenX) < halfWidth + other.labelWidth / 2 + LABEL_GAP
      && below > other.screenY - other.labelHeight - LABEL_GAP && below - marker.labelHeight < other.screenY + LABEL_GAP) {
      below = other.screenY + marker.labelHeight + LABEL_GAP;
    }
  }
  marker.screenY = above >= marker.labelHeight ? above : Math.min(height, below);
  let index = placed.length;
  while (index > 0) {
    const previous = placed[index - 1];
    if (previous === undefined || previous.screenY <= marker.screenY) {
      break;
    }
    placed[index] = previous;
    index -= 1;
  }
  placed[index] = marker;
};

const updateMarker = (element: HTMLElement, marker: WarehouseStaffMarkerValue, settings: StaffOverlaySettingsValue): void => {
  const { counter, overflow } = marker;
  element.className = COUNTER_CLASS;
  element.dataset.testid = `warehouse-scene-staff-count-${marker.areaId}`;
  if (counter === undefined) {
    delete element.dataset.comparison;
  }
  else {
    element.dataset.comparison = counter.comparison;
  }
  const extra = overflow > 0 ? `+${String(overflow)}` : '';
  const more = overflow > 0 ? settings.formatStaffOverflow?.(overflow) ?? extra : undefined;
  const description = [counter?.label, more].filter(Boolean).join('. ');
  element.setAttribute('role', 'img');
  element.setAttribute('aria-label', description);
  element.title = description;
  element.textContent = [counter === undefined ? undefined : MARK[counter.comparison], counter?.text, extra].filter(Boolean).join(' ');
};

export const createWarehouseStaffOverlay = (canvas: HTMLCanvasElement, host: HTMLElement): StaffOverlayValue => {
  const layer = document.createElement('div');
  layer.className = 'pointer-events-none absolute inset-0 overflow-hidden select-none';
  host.append(layer);
  const nodes = new Map<string, ProjectedElementValue>();
  const placed: ProjectedElementValue[] = [];
  const projection = new Matrix4();
  const previous = new Matrix4();
  const scratch = new Vector3();
  let isDirty = true;
  let lastWidth = 0;
  let lastHeight = 0;
  let axisX = 0;
  let axisY = 0;
  let shoulderRadius = 0;
  const pick = (x: number, y: number, radius: number): HTMLButtonElement | undefined => {
    let closest: HTMLButtonElement | undefined;
    let distance = Math.max(radius, shoulderRadius) ** 2;
    const axisLength = axisX ** 2 + axisY ** 2;
    for (const { element, screenX, screenY } of nodes.values()) {
      if (element instanceof HTMLButtonElement && !element.hidden && !element.disabled) {
        const dx = x - screenX;
        const dy = y - screenY;
        const height = axisLength === 0 ? 0 : Math.max(-0.83, Math.min(0.56, (dx * axisX + dy * axisY) / axisLength));
        const next = (dx - height * axisX) ** 2 + (dy - height * axisY) ** 2;
        if (next <= distance) {
          distance = next;
          closest = element;
        }
      }
    }
    return closest;
  };
  const unbind = bindWarehouseStaffPicking(canvas, pick);
  const ensureNode = (id: string, tag: 'button' | 'span', x: number, y: number, z: number): HTMLElement => {
    let node = nodes.get(id);
    if (node === undefined) {
      const element = document.createElement(tag);
      element.hidden = true;
      node = { element, labelHeight: 0, labelWidth: 0, point: new Vector3(), screenX: Number.NaN, screenY: Number.NaN };
      nodes.set(id, node);
      layer.append(element);
    }
    node.point.set(x, y, z);
    return node.element;
  };
  return {
    dispose: (): void => {
      unbind();
      layer.remove();
      nodes.clear();
    },
    project: (camera, width, height): void => {
      camera.updateMatrixWorld();
      projection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
      if (!isDirty && width === lastWidth && height === lastHeight && previous.equals(projection)) {
        return;
      }
      previous.copy(projection);
      lastWidth = width;
      lastHeight = height;
      axisX = projection.elements[4] * width / 2;
      axisY = -projection.elements[5] * height / 2;
      shoulderRadius = Math.abs(camera.projectionMatrix.elements[0]) * width * 0.15;
      placed.length = 0;
      for (const node of nodes.values()) {
        scratch.copy(node.point).applyMatrix4(projection);
        const { element } = node;
        element.hidden = Math.abs(scratch.x) > 1 || Math.abs(scratch.y) > 1 || Math.abs(scratch.z) > 1;
        node.screenX = (scratch.x + 1) * width / 2;
        node.screenY = (1 - scratch.y) * height / 2;
        if (element.hidden) {
          continue;
        }
        if (element instanceof HTMLSpanElement) {
          if (isDirty || node.labelWidth === 0) {
            node.labelWidth = element.offsetWidth;
            node.labelHeight = element.offsetHeight;
          }
          placeMarker(node, placed, width, height);
        }
        element.style.transform = `translate3d(${node.screenX.toFixed(2)}px,${node.screenY.toFixed(2)}px,0)`;
      }
      isDirty = false;
    },
    update: ({ actors, markers }, settings): void => {
      const retained = new Set<string>();
      for (const marker of markers) {
        const id = `area:${marker.areaId}`;
        retained.add(id);
        updateMarker(ensureNode(id, 'span', marker.x, 1.83, marker.z), marker, settings);
      }
      for (const actor of actors) {
        retained.add(actor.staffId);
        const element = ensureNode(actor.staffId, 'button', actor.x, 0.94, actor.z);
        if (element instanceof HTMLButtonElement) {
          element.type = 'button';
          element.className = ACTOR_CLASS;
          element.dataset.testid = `warehouse-scene-staff-avatar-${actor.staffId}`;
          element.dataset.areaId = actor.areaId;
          element.dataset.selected = String(actor.staffId === settings.selectedStaffId);
          element.setAttribute('aria-label', actor.displayName);
          element.setAttribute('aria-haspopup', 'dialog');
          element.disabled = settings.onStaffSelect === undefined;
          element.onclick = (): void => settings.onStaffSelect?.(actor.staffId);
        }
      }
      for (const [id, { element }] of nodes) {
        if (!retained.has(id)) {
          element.remove();
          nodes.delete(id);
        }
      }
      isDirty = true;
    },
  };
};
