import type { ReactElement } from 'react';

import type { ObjectRefValue } from '@/shared/routing';

import { useI18n } from '@/shared/i18n';
import {
  HudLayout,
  useInspectorFocus,
} from '@/widgets/hud-layout';
import { ScenePlaceholder } from '@/widgets/scene-viewport';

import { CatalogPanel } from './CatalogPanel';
import { ListingInspectorSlot } from './ListingInspectorSlot';

interface CatalogPageProps {
  focus: ObjectRefValue | undefined;
}

export const CatalogPage = ({ focus }: CatalogPageProps): ReactElement => {
  const { t } = useI18n();
  const inspectorFocus = useInspectorFocus('catalog', focus);

  return (
    <div className="contents" data-testid="page-catalog">
      <HudLayout
        {...inspectorFocus}
        inspector={<ListingInspectorSlot focus={focus} onClose={inspectorFocus.onInspectorClose} />}
        panel={<CatalogPanel focus={focus} />}
        scene={<ScenePlaceholder label={t('hud.scene.placeholder')} />}
      />
    </div>
  );
};
