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

interface CatalogPageProps {
  focus: ObjectRefValue | undefined;
}

export const CatalogPage = ({ focus }: CatalogPageProps): ReactElement => {
  const { t } = useI18n();
  const inspectorFocus = useInspectorFocus('catalog', focus);

  return (
    <HudLayout
      {...inspectorFocus}
      inspector={<ObjectInspector focus={focus} onClose={inspectorFocus.onInspectorClose} />}
      panel={<PanelPlaceholder description={t('section.catalog.placeholder')} title={t('section.catalog.title')} />}
      scene={<ScenePlaceholder label={t('hud.scene.placeholder')} />}
    />
  );
};
