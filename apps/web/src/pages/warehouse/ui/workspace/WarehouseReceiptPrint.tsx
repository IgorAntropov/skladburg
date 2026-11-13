import type { ReceivingTask } from '@skladburg/contracts/wms/v1/receiving';
import type { StockBalance } from '@skladburg/contracts/wms/v1/stock';
import type { ReactElement } from 'react';

import { PrintLabels } from '@/features/print-labels';
import { useI18n } from '@/shared/i18n';

import type { WarehouseWorkTranslate } from '../../i18n/workspaceSection';

interface WarehouseReceiptPrintProps {
  balance: StockBalance;
  t: WarehouseWorkTranslate;
  task: ReceivingTask;
}

export const WarehouseReceiptPrint = ({ balance, t, task }: WarehouseReceiptPrintProps): ReactElement => {
  const localizer = useI18n();
  return (
    <PrintLabels
      getPages={async () => (await import('../../model/warehouseLabelPages')).unitPrintPages(
        balance,
        new Map(task.orderLines.map(({ productId, productName }) => [productId, productName])),
        localizer,
        t,
        task.sourceDocumentNumber,
      )}
      label={t('warehouseWork.printUnit')}
    />
  );
};
