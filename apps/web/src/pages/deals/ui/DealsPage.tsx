import type { ReactElement } from 'react';

import type { ObjectRefValue } from '@/shared/routing';

import { useI18n } from '@/shared/i18n';
import {
  HudLayout,
  PanelPlaceholder,
  ScenePlaceholder,
  useInspectorFocus,
} from '@/widgets/hud-layout';
import { ObjectInspector } from '@/widgets/object-inspector';

interface DealsPageProps {
  focus: ObjectRefValue | undefined;
}

export const DealsPage = ({ focus }: DealsPageProps): ReactElement => {
  const { t } = useI18n();
  const inspectorFocus = useInspectorFocus('deals', focus);

  return (
    <HudLayout
      {...inspectorFocus}
      inspector={<ObjectInspector focus={focus} onClose={inspectorFocus.onInspectorClose} />}
      panel={<PanelPlaceholder description={t('section.deals.placeholder')} title={t('section.deals.title')} />}
      scene={<ScenePlaceholder label={t('hud.scene.placeholder')} />}
    />
  );
};
