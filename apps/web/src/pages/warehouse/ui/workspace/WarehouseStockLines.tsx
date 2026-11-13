import type { StockLine } from '@skladburg/contracts/wms/v1/stock';
import type { ReactElement } from 'react';

import { useI18n } from '@/shared/i18n';

import type { WarehouseWorkTranslate } from '../../i18n/workspaceSection';

import { formatStockQuantity } from '../../model/formatStockQuantity';
import { readStockStatus } from './warehouseFormatting';

interface WarehouseStockLinesProps {
  lines: readonly StockLine[];
  productNames?: ReadonlyMap<string, string> | undefined;
  t: WarehouseWorkTranslate;
}

export const WarehouseStockLines = ({ lines, productNames, t }: WarehouseStockLinesProps): ReactElement => {
  const { formatCalendarDate, locale } = useI18n();
  const format = new Intl.NumberFormat(locale);

  return (
    <ul className="divide-y divide-line text-sm">
      {lines.map((line, index) => {
        const { batch } = line;
        const productName = batch === undefined ? undefined : productNames?.get(batch.productId);

        return (
          <li
            className="flex flex-wrap items-start justify-between gap-x-3 py-1.5"
            key={`${batch?.id ?? ''}:${String(line.status)}:${String(index)}`}
          >
            {batch !== undefined && (
              <div className="min-w-0 wrap-anywhere">
                {productName !== undefined && <p className="font-medium">{productName}</p>}
                <p>{t('warehouseWork.batch', { number: batch.number })}</p>
                {productName === undefined && (
                  <p className="text-xs text-on-panel-muted">{t('warehouseWork.productId', { id: batch.productId })}</p>
                )}
                {batch.expiresOn !== undefined && (
                  <p className="text-xs text-on-panel-muted">
                    {t('warehouseWork.expires', { date: formatCalendarDate(batch.expiresOn) })}
                  </p>
                )}
              </div>
            )}
            <span className="tabular-nums">{formatStockQuantity(line, format, t)}</span>
            <span className="text-on-panel-muted">{readStockStatus(line.status, t)}</span>
          </li>
        );
      })}
    </ul>
  );
};
