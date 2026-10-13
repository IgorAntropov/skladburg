import {
  isEditableTarget,
  isInsideOverlay,
} from '@/shared/lib/keyboard';

import type { SceneCameraCommandValue } from '../model/useSceneCameraStore';

export type CameraHotkeyEventValue = Pick<
  KeyboardEvent,
  'altKey' | 'code' | 'ctrlKey' | 'defaultPrevented' | 'isComposing' | 'metaKey' | 'repeat' | 'target'
>;

const ROTATE_LEFT: SceneCameraCommandValue = { direction: -1, kind: 'rotate' };
const ROTATE_RIGHT: SceneCameraCommandValue = { direction: 1, kind: 'rotate' };
const ZOOM_IN: SceneCameraCommandValue = { direction: 1, kind: 'zoom' };
const ZOOM_OUT: SceneCameraCommandValue = { direction: -1, kind: 'zoom' };
const HOME: SceneCameraCommandValue = { kind: 'home' };

const COMMAND_BY_CODE: Readonly<Record<string, SceneCameraCommandValue>> = {
  Equal: ZOOM_IN,
  Home: HOME,
  KeyE: ROTATE_RIGHT,
  KeyQ: ROTATE_LEFT,
  Minus: ZOOM_OUT,
  NumpadAdd: ZOOM_IN,
  NumpadSubtract: ZOOM_OUT,
};

export const resolveCameraHotkey = (event: CameraHotkeyEventValue): SceneCameraCommandValue | undefined => {
  const isModified = event.ctrlKey || event.metaKey || event.altKey;

  if (isModified || event.isComposing || event.defaultPrevented) {
    return undefined;
  }

  const command = Object.hasOwn(COMMAND_BY_CODE, event.code) ? COMMAND_BY_CODE[event.code] : undefined;

  if (command === undefined) {
    return undefined;
  }

  if (event.repeat && command.kind !== 'zoom') {
    return undefined;
  }

  if (isEditableTarget(event.target) || isInsideOverlay(event.target)) {
    return undefined;
  }

  return command;
};
