import type { ReactElement } from 'react';

import type { ObjectRefValue } from '@/shared/routing';

import { useI18n } from '@/shared/i18n';
import {
  HudLayout,
  ScenePlaceholder,
  useInspectorFocus,
} from '@/widgets/hud-layout';
import { ObjectInspector } from '@/widgets/object-inspector';

import { WarehouseLists } from './WarehouseLists';

interface WarehousePageProps {
  focus: ObjectRefValue | undefined;
}

export const WarehousePage = ({ focus }: WarehousePageProps): ReactElement => {
  const { t } = useI18n();
  const inspectorFocus = useInspectorFocus('warehouse', focus);

  return (
    <>
      <h1 className="sr-only">{t('section.warehouse.title')}</h1>
      <HudLayout
        {...inspectorFocus}
        inspector={<ObjectInspector focus={focus} onClose={inspectorFocus.onInspectorClose} />}
        lists={<WarehouseLists />}
        scene={<ScenePlaceholder label={t('warehouse.placeholder')} />}
      />
    </>
  );
};
