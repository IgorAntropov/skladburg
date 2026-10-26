import { OrthographicCamera } from 'three';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import type { NetworkSceneInteractionValue } from '../../model/networkSceneInteraction';
import type { SiteMarkModeValue } from '../banner/siteMarkMetrics';
import type { NetworkSceneLayoutValue } from '../layout';

import { createSiteMarkMode } from '../banner/siteMarkMetrics';
import { buildNetworkSceneLayout } from '../layout';
import {
  createTestCity,
  createTestModel,
  createTestSite,
} from '../layout/layoutTestSupport';
import { createNetworkPointerPicker } from './createNetworkPointerPicker';
import {
  buildPickTargets,
  createPickCandidates,
  projectPickCandidates,
} from './projectPickCandidates';

interface PointerInitValue {
  button?: number;
  buttons?: number;
  isPrimary?: boolean;
  pointerId?: number;
  pointerType?: string;
  x: number;
  y: number;
}

const SIZE = { height: 800, width: 1200 };
const ELEVATION = Math.atan(1 / Math.SQRT2);

const createCamera = (): OrthographicCamera => {
  const camera = new OrthographicCamera(-SIZE.width / 2, SIZE.width / 2, SIZE.height / 2, -SIZE.height / 2, 0.1, 2000);
  const distance = 500;
  const azimuth = Math.PI / 4;

  camera.zoom = 12;
  camera.updateProjectionMatrix();
  camera.position.set(
    distance * Math.cos(ELEVATION) * Math.sin(azimuth),
    distance * Math.sin(ELEVATION),
    distance * Math.cos(ELEVATION) * Math.cos(azimuth),
  );
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();

  return camera;
};

const createInteraction = (): NetworkSceneInteractionValue => ({
  focusRequest: undefined,
  hoveredId: undefined,
  hoveredSiteIds: [],
  onHoverEnd: vi.fn(),
  onHoverStart: vi.fn(),
  onSelect: vi.fn(),
  selected: undefined,
});

const dispatchPointer = (element: HTMLElement, type: string, init: PointerInitValue): void => {
  element.dispatchEvent(new PointerEvent(type, {
    bubbles: true,
    button: init.button ?? 0,
    buttons: init.buttons ?? 0,
    clientX: init.x,
    clientY: init.y,
    isPrimary: init.isPrimary ?? true,
    pointerId: init.pointerId ?? 1,
    pointerType: init.pointerType ?? 'touch',
  }));
};

describe('createNetworkPointerPicker', () => {
  const layout: NetworkSceneLayoutValue = buildNetworkSceneLayout(createTestModel(
    [createTestCity('a', 4, 2), createTestCity('b', 7, 3)],
    [],
    [createTestSite('a-site', 'a', true), createTestSite('b-site', 'b')],
  ));
  const targets = buildPickTargets(layout);
  const camera = createCamera();
  const projected = projectPickCandidates(targets, camera, SIZE, createPickCandidates(targets), true);
  const site = projected.sites.find(candidate => candidate.id === 'a-site');
  const otherCity = projected.cities.find(candidate => candidate.id === 'b');

  let element: HTMLDivElement;
  let interaction: NetworkSceneInteractionValue;
  let markMode: SiteMarkModeValue;
  let dispose: () => void;

  beforeEach(() => {
    element = document.createElement('div');
    interaction = createInteraction();
    markMode = createSiteMarkMode();
    dispose = createNetworkPointerPicker({
      element,
      getInteraction: (): NetworkSceneInteractionValue => interaction,
      getView: () => ({ camera, size: SIZE }),
      markMode,
      targets,
    });
  });

  afterEach(() => {
    dispose();
  });

  it('selects the site under a tap', () => {
    const point = { x: site?.baseX ?? 0, y: site?.baseY ?? 0 };

    dispatchPointer(element, 'pointerdown', point);
    dispatchPointer(element, 'pointerup', point);

    expect(interaction.onSelect).toHaveBeenCalledExactlyOnceWith({ id: 'a-site', kind: 'site' });
  });

  it('reaches 1.6 m of the site from the near view and 1.0 m from the far view', () => {
    const baseX = site?.baseX ?? 0;
    const tipY = site?.tipY ?? 0;
    const tap = (x: number): void => {
      dispatchPointer(element, 'pointerdown', { pointerType: 'mouse', x, y: tipY });
      dispatchPointer(element, 'pointerup', { pointerType: 'mouse', x, y: tipY });
    };
    const siteTarget = { id: 'a-site', kind: 'site' };
    const betweenReachesX = baseX + 28;

    markMode.isFar = true;
    tap(betweenReachesX);

    expect(interaction.onSelect).not.toHaveBeenCalledWith(siteTarget);

    markMode.isFar = false;
    tap(betweenReachesX);

    expect(interaction.onSelect).toHaveBeenCalledWith(siteTarget);
  });

  it('selects the city under a tap on its ground', () => {
    const point = { x: (otherCity?.x ?? 0) + (otherCity?.radiusX ?? 0) * 0.7, y: otherCity?.y ?? 0 };

    dispatchPointer(element, 'pointerdown', point);
    dispatchPointer(element, 'pointerup', point);

    expect(interaction.onSelect).toHaveBeenCalledExactlyOnceWith({ id: 'b', kind: 'city' });
  });

  it('selects nothing for a tap on the empty ground', () => {
    dispatchPointer(element, 'pointerdown', { x: 5, y: 5 });
    dispatchPointer(element, 'pointerup', { x: 5, y: 5 });

    expect(interaction.onSelect).not.toHaveBeenCalled();
  });

  it('treats a small shift as a tap and a long one as a drag', () => {
    const baseX = site?.baseX ?? 0;
    const baseY = site?.baseY ?? 0;

    dispatchPointer(element, 'pointerdown', { x: baseX, y: baseY });
    dispatchPointer(element, 'pointerup', { x: baseX + 4, y: baseY });

    expect(interaction.onSelect).toHaveBeenCalledTimes(1);

    dispatchPointer(element, 'pointerdown', { x: baseX, y: baseY });
    dispatchPointer(element, 'pointerup', { x: baseX + 6, y: baseY });

    expect(interaction.onSelect).toHaveBeenCalledTimes(1);
  });

  it('does not select with a second finger or after a cancel', () => {
    const point = { x: site?.baseX ?? 0, y: site?.baseY ?? 0 };

    dispatchPointer(element, 'pointerdown', { ...point, pointerId: 1 });
    dispatchPointer(element, 'pointerdown', { ...point, isPrimary: false, pointerId: 2 });
    dispatchPointer(element, 'pointerup', { ...point, isPrimary: false, pointerId: 2 });
    dispatchPointer(element, 'pointerup', { ...point, pointerId: 1 });

    dispatchPointer(element, 'pointerdown', point);
    element.dispatchEvent(new PointerEvent('pointercancel', { bubbles: true, pointerId: 1 }));
    dispatchPointer(element, 'pointerup', point);

    expect(interaction.onSelect).not.toHaveBeenCalled();
  });

  it('selects again after a gesture with two fingers is over', () => {
    const point = { x: site?.baseX ?? 0, y: site?.baseY ?? 0 };

    dispatchPointer(element, 'pointerdown', { ...point, pointerId: 1 });
    dispatchPointer(element, 'pointerdown', { ...point, isPrimary: false, pointerId: 2 });
    dispatchPointer(element, 'pointerup', { ...point, isPrimary: false, pointerId: 2 });
    dispatchPointer(element, 'pointerup', { ...point, pointerId: 1 });
    dispatchPointer(element, 'pointerdown', { ...point, pointerId: 3 });
    dispatchPointer(element, 'pointerup', { ...point, pointerId: 3 });

    expect(interaction.onSelect).toHaveBeenCalledTimes(1);
  });

  it('does not select with the secondary button', () => {
    const point = { x: site?.baseX ?? 0, y: site?.baseY ?? 0 };

    dispatchPointer(element, 'pointerdown', { ...point, button: 2, pointerType: 'mouse' });
    dispatchPointer(element, 'pointerup', { ...point, button: 2, pointerType: 'mouse' });

    expect(interaction.onSelect).not.toHaveBeenCalled();
  });

  it('reaches farther for a touch than for a mouse', () => {
    const point = { x: (otherCity?.x ?? 0) + (otherCity?.radiusX ?? 0) + 17, y: otherCity?.y ?? 0 };

    dispatchPointer(element, 'pointerdown', { ...point, pointerType: 'mouse' });
    dispatchPointer(element, 'pointerup', { ...point, pointerType: 'mouse' });

    expect(interaction.onSelect).not.toHaveBeenCalled();

    dispatchPointer(element, 'pointerdown', point);
    dispatchPointer(element, 'pointerup', point);

    expect(interaction.onSelect).toHaveBeenCalledExactlyOnceWith({ id: 'b', kind: 'city' });
  });

  it('starts the hover once, ends it on leaving and sets the pointer cursor over an object', () => {
    const over = { pointerType: 'mouse', x: site?.baseX ?? 0, y: site?.baseY ?? 0 };

    dispatchPointer(element, 'pointermove', over);
    dispatchPointer(element, 'pointermove', { ...over, x: over.x + 1 });

    expect(interaction.onHoverStart).toHaveBeenCalledExactlyOnceWith('a-site');
    expect(element.style.cursor).toBe('pointer');

    dispatchPointer(element, 'pointermove', { pointerType: 'mouse', x: 5, y: 5 });

    expect(interaction.onHoverEnd).toHaveBeenCalledExactlyOnceWith('a-site');
    expect(element.style.cursor).toBe('');
  });

  it('moves the hover from one object to another', () => {
    dispatchPointer(element, 'pointermove', { pointerType: 'mouse', x: site?.baseX ?? 0, y: site?.baseY ?? 0 });
    dispatchPointer(element, 'pointermove', {
      pointerType: 'mouse',
      x: (otherCity?.x ?? 0) + (otherCity?.radiusX ?? 0) * 0.7,
      y: otherCity?.y ?? 0,
    });

    expect(interaction.onHoverEnd).toHaveBeenCalledExactlyOnceWith('a-site');
    expect(interaction.onHoverStart).toHaveBeenNthCalledWith(2, 'b');
  });

  it('ends the hover when the mouse leaves the element', () => {
    dispatchPointer(element, 'pointermove', { pointerType: 'mouse', x: site?.baseX ?? 0, y: site?.baseY ?? 0 });
    dispatchPointer(element, 'pointerleave', { pointerType: 'mouse', x: 0, y: 0 });

    expect(interaction.onHoverEnd).toHaveBeenCalledExactlyOnceWith('a-site');
    expect(element.style.cursor).toBe('');
  });

  it('sets no hover for a touch and while a button is held', () => {
    const over = { x: site?.baseX ?? 0, y: site?.baseY ?? 0 };

    dispatchPointer(element, 'pointermove', { ...over, pointerType: 'touch' });
    dispatchPointer(element, 'pointermove', { ...over, buttons: 1, pointerType: 'mouse' });

    expect(interaction.onHoverStart).not.toHaveBeenCalled();
    expect(element.style.cursor).toBe('');
  });

  it('removes its listeners and ends the hover when disposed', () => {
    dispatchPointer(element, 'pointermove', { pointerType: 'mouse', x: site?.baseX ?? 0, y: site?.baseY ?? 0 });
    dispose();

    expect(interaction.onHoverEnd).toHaveBeenCalledExactlyOnceWith('a-site');
    expect(element.style.cursor).toBe('');

    const point = { x: site?.baseX ?? 0, y: site?.baseY ?? 0 };

    dispatchPointer(element, 'pointerdown', point);
    dispatchPointer(element, 'pointerup', point);
    dispatchPointer(element, 'pointermove', { ...point, pointerType: 'mouse' });

    expect(interaction.onSelect).not.toHaveBeenCalled();
    expect(interaction.onHoverStart).toHaveBeenCalledTimes(1);
  });
});
