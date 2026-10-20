import type {
  ReactElement,
  ReactNode,
} from 'react';

import { useId } from 'react';

import { useI18n } from '@/shared/i18n';

import { WarehouseListContent } from './WarehouseListContent';

interface WarehouseListProps {
  action: ReactNode;
}

export const WarehouseList = ({ action }: WarehouseListProps): ReactElement => {
  const { t } = useI18n();

  const titleId = useId();

  return (
    <section aria-labelledby={titleId} className="flex flex-col gap-4">
      <h2 className="sr-only" id={titleId}>
        {t('warehouse.warehouses.title')}
      </h2>
      <div className="flex flex-col items-start gap-2">{action}</div>
      <WarehouseListContent />
    </section>
  );
};
