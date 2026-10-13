import type { ReactElement } from 'react';

import {
  House,
  RotateCcw,
  RotateCw,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';

import { useI18n } from '@/shared/i18n';
import {
  IconButton,
  Panel,
  Tooltip,
  TooltipGroup,
} from '@/shared/ui';

import { useSceneCameraHotkeys } from '../model/useSceneCameraHotkeys';
import { useSceneCameraStore } from '../model/useSceneCameraStore';

const GROUP_CLASS_NAME = 'flex items-center gap-1 p-1.5 [--menu-in-y:4px] motion-safe:animate-menu-in';

const DIVIDER_CLASS_NAME = 'mx-0.5 h-6 w-px shrink-0 bg-line';

const ICON_CLASS_NAME = 'size-5';

const SHORTCUTS = {
  home: 'Home',
  rotateLeft: 'Q',
  rotateRight: 'E',
  zoomIn: 'Plus',
  zoomOut: '-',
} as const;

const SceneCameraButtons = (): ReactElement => {
  const { t } = useI18n();
  const sendCommand = useSceneCameraStore(state => state.sendCommand);

  useSceneCameraHotkeys();

  const handleZoomInClick = (): void => {
    console.log('> SceneCameraControls -> handleZoomInClick:', { direction: 1 });
    sendCommand({ direction: 1, kind: 'zoom' });
  };

  const handleZoomOutClick = (): void => {
    console.log('> SceneCameraControls -> handleZoomOutClick:', { direction: -1 });
    sendCommand({ direction: -1, kind: 'zoom' });
  };

  const handleRotateLeftClick = (): void => {
    console.log('> SceneCameraControls -> handleRotateLeftClick:', { direction: -1 });
    sendCommand({ direction: -1, kind: 'rotate' });
  };

  const handleRotateRightClick = (): void => {
    console.log('> SceneCameraControls -> handleRotateRightClick:', { direction: 1 });
    sendCommand({ direction: 1, kind: 'rotate' });
  };

  const handleHomeClick = (): void => {
    console.log('> SceneCameraControls -> handleHomeClick:', {});
    sendCommand({ kind: 'home' });
  };

  return (
    <Panel aria-label={t('scene.camera.label')} className={GROUP_CLASS_NAME} role="group">
      <TooltipGroup>
        <Tooltip content={t('scene.camera.rotateLeft')} shortcut={SHORTCUTS.rotateLeft}>
          <IconButton
            data-testid="scene-camera-rotate-left"
            icon={<RotateCcw className={ICON_CLASS_NAME} />}
            label={t('scene.camera.rotateLeft')}
            onClick={handleRotateLeftClick}
            variant="ghost"
          />
        </Tooltip>
        <Tooltip content={t('scene.camera.rotateRight')} shortcut={SHORTCUTS.rotateRight}>
          <IconButton
            data-testid="scene-camera-rotate-right"
            icon={<RotateCw className={ICON_CLASS_NAME} />}
            label={t('scene.camera.rotateRight')}
            onClick={handleRotateRightClick}
            variant="ghost"
          />
        </Tooltip>
        <span aria-hidden className={DIVIDER_CLASS_NAME} />
        <Tooltip content={t('scene.camera.zoomOut')} shortcut={SHORTCUTS.zoomOut}>
          <IconButton
            data-testid="scene-camera-zoom-out"
            icon={<ZoomOut className={ICON_CLASS_NAME} />}
            label={t('scene.camera.zoomOut')}
            onClick={handleZoomOutClick}
            variant="ghost"
          />
        </Tooltip>
        <Tooltip content={t('scene.camera.zoomIn')} shortcut={SHORTCUTS.zoomIn}>
          <IconButton
            data-testid="scene-camera-zoom-in"
            icon={<ZoomIn className={ICON_CLASS_NAME} />}
            label={t('scene.camera.zoomIn')}
            onClick={handleZoomInClick}
            variant="ghost"
          />
        </Tooltip>
        <span aria-hidden className={DIVIDER_CLASS_NAME} />
        <Tooltip content={t('scene.camera.home')} shortcut={SHORTCUTS.home}>
          <IconButton
            data-testid="scene-camera-home"
            icon={<House className={ICON_CLASS_NAME} />}
            label={t('scene.camera.home')}
            onClick={handleHomeClick}
            variant="ghost"
          />
        </Tooltip>
      </TooltipGroup>
    </Panel>
  );
};

export const SceneCameraControls = (): null | ReactElement => {
  const isCameraReady = useSceneCameraStore(state => state.isCameraReady);

  if (!isCameraReady) {
    return null;
  }

  return <SceneCameraButtons />;
};
