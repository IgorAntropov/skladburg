import type { PickingTask } from '@skladburg/contracts/wms/v1/picking';
import type { StockBalance } from '@skladburg/contracts/wms/v1/stock';

import { HandlingUnitKind } from '@skladburg/contracts/wms/v1/stock';

import type { PrintPageValue } from '@/features/print-labels';
import type { I18nSnapshotValue } from '@/shared/i18n';

import type { WarehouseWorkTranslate } from '../i18n/workspaceSection';
import type { WarehouseCellAddressValue } from './warehouseCells';

import { formatStockQuantity } from './formatStockQuantity';

export const cellPrintPage = ({ code, id }: WarehouseCellAddressValue): PrintPageValue => ({
  address: { kind: 'object', object: { id, type: 'cell' } },
  code,
  details: [],
  heading: code,
  kind: 'cell',
});

export const rackPrintPages = (cells: readonly WarehouseCellAddressValue[], selected: WarehouseCellAddressValue): PrintPageValue[] =>
  cells.filter(cell => cell.zoneCode === selected.zoneCode && cell.rowCode === selected.rowCode && cell.rackCode === selected.rackCode)
    .map(cellPrintPage);

export const pickingPrintPages = (
  task: PickingTask,
  cells: ReadonlyMap<string, string>,
  canViewDeals: boolean,
  locale: string,
  t: WarehouseWorkTranslate,
): PrintPageValue[] => {
  const format = new Intl.NumberFormat(locale);
  const details = task.units.flatMap(({ cellId, handlingUnit, lines }) => {
    if (handlingUnit === undefined) {
      return [];
    }
    const location = cells.get(cellId) ?? t('warehouseWork.noCell');
    const stock = lines.map((line) => {
      const quantity = formatStockQuantity(line, format, t);
      const batch = line.batch === undefined ? '' : t('warehouseWork.batch', { number: line.batch.number });
      return [batch, quantity].filter(part => part !== '').join(' · ');
    });
    return [`${location} · ${handlingUnit.sscc}`, ...stock];
  });
  return [{
    address: canViewDeals ? { kind: 'object', object: { id: task.dealId, type: 'deal' } } : undefined,
    details,
    heading: t('warehouseWork.pickingSheet'),
    kind: 'document',
  }];
};

export const unitPrintPages = (
  balance: StockBalance,
  productNames: ReadonlyMap<string, string>,
  { formatCalendarDate, locale }: Pick<I18nSnapshotValue, 'formatCalendarDate' | 'locale'>,
  t: WarehouseWorkTranslate,
  reference: string | undefined,
): PrintPageValue[] => {
  const { handlingUnit } = balance;
  if (handlingUnit === undefined) {
    return [];
  }
  const format = new Intl.NumberFormat(locale);
  const details: Extract<PrintPageValue, { kind: 'unit' }>['details'][number][] = [];
  if (reference !== undefined && reference !== '') {
    details.push(t('warehouseWork.reference', { number: reference }));
  }
  const line = balance.lines[0];
  if (line !== undefined) {
    const { batch } = line;
    const quantity = formatStockQuantity(line, format, t);
    if (batch === undefined) {
      details.push(quantity);
    }
    else {
      const batchNumber = t('warehouseWork.batch', { number: batch.number });
      const expiry = batch.expiresOn === undefined ? undefined : t('warehouseWork.expires', { date: formatCalendarDate(batch.expiresOn) });
      details.push({
        label: productNames.get(batch.productId) ?? t('warehouseWork.productId', { id: batch.productId }),
        value: [batchNumber, expiry, quantity].filter(part => part !== undefined).join(' · '),
      });
    }
  }
  if (balance.lines.length > 1) {
    details.push(t('warehouseWork.printMoreLines', { count: balance.lines.length - 1 }));
  }
  return [{
    address: { kind: 'object', object: { id: handlingUnit.id, type: 'handling_unit' } },
    code: handlingUnit.sscc,
    details,
    heading: t(handlingUnit.kind === HandlingUnitKind.BOX ? 'warehouseWork.kindBox' : 'warehouseWork.kindPallet'),
    kind: 'unit',
  }];
};
