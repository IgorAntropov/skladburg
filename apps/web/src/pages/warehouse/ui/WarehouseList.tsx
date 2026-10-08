import type { ReactElement } from 'react';

import { useId } from 'react';

import { useI18n } from '@/shared/i18n';

import { WarehouseListContent } from './WarehouseListContent';

export const WarehouseList = (): ReactElement => {
  const { t } = useI18n();

  const titleId = useId();

  return (
    <section aria-labelledby={titleId} className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold" id={titleId}>
        {t('warehouse.warehouses.title')}
      </h2>
      <WarehouseListContent />
    </section>
  );
};
