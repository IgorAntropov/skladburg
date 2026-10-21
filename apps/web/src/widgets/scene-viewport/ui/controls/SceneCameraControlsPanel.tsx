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

import { useSceneCameraStore } from '../../model/useSceneCameraStore';

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

export const SceneCameraControlsPanel = (): ReactElement => {
  const { t } = useI18n();
  const sendCommand = useSceneCameraStore(state => state.sendCommand);

  const handleZoomInClick = (): void => {
    console.log('> SceneCameraControlsPanel -> handleZoomInClick:', { direction: 1 });
    sendCommand({ direction: 1, kind: 'zoom' });
  };

  const handleZoomOutClick = (): void => {
    console.log('> SceneCameraControlsPanel -> handleZoomOutClick:', { direction: -1 });
    sendCommand({ direction: -1, kind: 'zoom' });
  };

  const handleRotateLeftClick = (): void => {
    console.log('> SceneCameraControlsPanel -> handleRotateLeftClick:', { direction: -1 });
    sendCommand({ direction: -1, kind: 'rotate' });
  };

  const handleRotateRightClick = (): void => {
    console.log('> SceneCameraControlsPanel -> handleRotateRightClick:', { direction: 1 });
    sendCommand({ direction: 1, kind: 'rotate' });
  };

  const handleHomeClick = (): void => {
    console.log('> SceneCameraControlsPanel -> handleHomeClick:', {});
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
            variant="neutral"
          />
        </Tooltip>
        <Tooltip content={t('scene.camera.rotateRight')} shortcut={SHORTCUTS.rotateRight}>
          <IconButton
            data-testid="scene-camera-rotate-right"
            icon={<RotateCw className={ICON_CLASS_NAME} />}
            label={t('scene.camera.rotateRight')}
            onClick={handleRotateRightClick}
            variant="neutral"
          />
        </Tooltip>
        <span aria-hidden className={DIVIDER_CLASS_NAME} />
        <Tooltip content={t('scene.camera.zoomOut')} shortcut={SHORTCUTS.zoomOut}>
          <IconButton
            data-testid="scene-camera-zoom-out"
            icon={<ZoomOut className={ICON_CLASS_NAME} />}
            label={t('scene.camera.zoomOut')}
            onClick={handleZoomOutClick}
            variant="neutral"
          />
        </Tooltip>
        <Tooltip content={t('scene.camera.zoomIn')} shortcut={SHORTCUTS.zoomIn}>
          <IconButton
            data-testid="scene-camera-zoom-in"
            icon={<ZoomIn className={ICON_CLASS_NAME} />}
            label={t('scene.camera.zoomIn')}
            onClick={handleZoomInClick}
            variant="neutral"
          />
        </Tooltip>
        <span aria-hidden className={DIVIDER_CLASS_NAME} />
        <Tooltip content={t('scene.camera.home')} shortcut={SHORTCUTS.home}>
          <IconButton
            data-testid="scene-camera-home"
            icon={<House className={ICON_CLASS_NAME} />}
            label={t('scene.camera.home')}
            onClick={handleHomeClick}
            variant="neutral"
          />
        </Tooltip>
      </TooltipGroup>
    </Panel>
  );
};
