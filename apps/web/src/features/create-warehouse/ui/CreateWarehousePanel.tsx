import type { ReactElement } from 'react';

import { useId } from 'react';

import { useI18n } from '@/shared/i18n';

import type { CreateWarehouseLauncherValue } from '../model/useCreateWarehouseLauncher';

export interface CreateWarehousePanelProps {
  launcher: CreateWarehouseLauncherValue;
}

export const CreateWarehousePanel = ({ launcher }: CreateWarehousePanelProps): ReactElement => {
  const { t } = useI18n();
  const titleId = useId();

  const {
    close,
    complete,
    Form,
    panelId,
  } = launcher;

  return (
    <section aria-labelledby={titleId} className="flex flex-col gap-6" data-testid="create-warehouse-panel" id={panelId}>
      <h2 className="text-2xl font-semibold tracking-tight text-balance" id={titleId}>{t('warehouse.create.title')}</h2>
      {Form !== undefined && <Form onCancel={close} onCreated={complete} />}
    </section>
  );
};
