import type { LucideIcon } from 'lucide-react';
import type { ReactElement } from 'react';

import {
  Ban,
  MonitorOff,
} from 'lucide-react';

import type { SceneOffReasonValue } from '@/features/scene-settings';

import { useSceneSettingsStore } from '@/features/scene-settings';
import { useI18n } from '@/shared/i18n';
import { Button } from '@/shared/ui';

import { ScenePlaceholder } from './ScenePlaceholder';

interface SceneOffPlaceholderProps {
  label: string;
  reason: SceneOffReasonValue;
}

const OFF_REASON_MESSAGE_KEYS = {
  noWebGl: 'scene.off.noWebGl',
  phoneDefault: 'scene.off.phoneDefault',
  preference: 'scene.off.preference',
} as const satisfies Record<SceneOffReasonValue, string>;

const OFF_REASON_ICONS = {
  noWebGl: MonitorOff,
  phoneDefault: Ban,
  preference: Ban,
} as const satisfies Record<SceneOffReasonValue, LucideIcon>;

export const SceneOffPlaceholder = ({ label, reason }: SceneOffPlaceholderProps): ReactElement => {
  const { t } = useI18n();
  const setPreference = useSceneSettingsStore(state => state.setPreference);

  const isEnableActionShown = reason === 'phoneDefault';

  const handleEnableSceneClick = (): void => {
    console.log('> SceneOffPlaceholder -> handleEnableSceneClick:', { reason });
    setPreference('auto');
  };

  const action = isEnableActionShown
    ? <Button onClick={handleEnableSceneClick} variant="secondary">{t('scene.off.enable')}</Button>
    : undefined;

  return (
    <ScenePlaceholder
      action={action}
      hint={t(OFF_REASON_MESSAGE_KEYS[reason])}
      icon={OFF_REASON_ICONS[reason]}
      label={label}
      role="status"
    />
  );
};
