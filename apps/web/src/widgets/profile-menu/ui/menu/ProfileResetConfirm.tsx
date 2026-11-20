import type { ReactElement } from 'react';

import { ResetDemoConfirm } from '@/features/reset-demo';
import {
  useDemoScenario,
  WAREHOUSE_YARD_MORNING,
} from '@/shared/api';
import { useI18n } from '@/shared/i18n';
import { useViewportClass } from '@/shared/lib/viewport';

import { demoScenarioCatalog } from '../../i18n/demoScenarioRu';
import { MORNING_YARD_PATH } from '../../lib/morningYardPath';

export interface ProfileResetConfirmProps {
  onClose: () => void;
}

export const ProfileResetConfirm = ({ onClose }: ProfileResetConfirmProps): ReactElement => {
  const { createSectionTranslator } = useI18n();
  const demoScenario = useDemoScenario();
  const viewportClass = useViewportClass();

  const isStacked = viewportClass === 'phone';
  const t = createSectionTranslator(demoScenarioCatalog);
  const messages = demoScenario?.current === WAREHOUSE_YARD_MORNING
    ? {
        done: t('demoScenario.reset.done'),
        hint: t('demoScenario.reset.hint'),
        prompt: t('demoScenario.reset.prompt'),
      }
    : undefined;

  const handleResetSuccess = (): void => {
    if (demoScenario?.current === WAREHOUSE_YARD_MORNING) {
      demoScenario.change(WAREHOUSE_YARD_MORNING, MORNING_YARD_PATH);
    }
  };

  return <ResetDemoConfirm isStacked={isStacked} messages={messages} onClose={onClose} onResetSuccess={handleResetSuccess} />;
};
