import type { Warehouse } from '@skladburg/contracts/organization/v1/organization';
import type {
  StockBalance,
  StockLine,
  StockMovement,
} from '@skladburg/contracts/wms/v1/stock';
import type { ReactElement } from 'react';

import { timestampMs } from '@bufbuild/protobuf/wkt';

import type { ObjectRefValue } from '@/shared/routing';

import { useI18n } from '@/shared/i18n';
import {
  Card,
  TextLink,
} from '@/shared/ui';

import type { WarehouseWorkTranslate } from '../../i18n/workspaceSection';

import {
  formatStockQuantity,
  readMovementKind,
  readStockLocation,
  readStockStatus,
} from './warehouseFormatting';

interface WarehouseInventoryProps {
  cells: ReadonlyMap<string, string>;
  focus: ObjectRefValue | undefined;
  t: WarehouseWorkTranslate;
}

interface WarehouseMovementsProps extends Omit<WarehouseInventoryProps, 'focus'> {
  balances: readonly StockBalance[] | undefined;
  canViewDeals: boolean;
  movements: readonly StockMovement[];
  productNames: ReadonlyMap<string, string>;
  warehouse: Warehouse;
}

interface WarehouseStockLinesProps {
  lines: readonly StockLine[];
  productNames?: ReadonlyMap<string, string> | undefined;
  t: WarehouseWorkTranslate;
}

interface WarehouseStockProps extends WarehouseInventoryProps {
  balances: readonly StockBalance[];
  productNames: ReadonlyMap<string, string>;
}

const MOVEMENT_TIME_FORMAT = { day: 'numeric', hour: '2-digit', minute: '2-digit', month: 'short' } as const;

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

export const WarehouseAddresses = ({ cells, focus, t }: WarehouseInventoryProps): ReactElement => (
  <ul className="grid grid-cols-1 gap-2 @sm:grid-cols-2" data-testid="warehouse-addresses">
    {[...cells].map(([id, code]) => (
      <li key={id}>
        <TextLink
          aria-current={focus?.id === id ? 'location' : undefined}
          className="w-full border border-line bg-panel-solid px-3 tabular-nums"
          isFocusRequested
          to={{ kind: 'object', object: { id, type: 'cell' } }}
        >
          {t('warehouseWork.cell')}
          {' '}
          {code}
        </TextLink>
      </li>
    ))}
  </ul>
);

export const WarehouseStock = ({ balances, cells, focus, productNames, t }: WarehouseStockProps): ReactElement => {
  const visible = balances.filter(balance =>
    (focus?.type !== 'cell' || balance.cellId === focus.id)
    && (focus?.type !== 'handling_unit' || balance.handlingUnit?.id === focus.id));

  if (visible.length === 0) {
    return <p role="status">{t('warehouseWork.emptyStock')}</p>;
  }

  return (
    <ul className="grid grid-cols-1 gap-3 @lg:grid-cols-2" data-testid="warehouse-stock">
      {visible.map((balance) => {
        const { cellId, handlingUnit } = balance;
        if (handlingUnit === undefined) {
          return null;
        }
        const location = readStockLocation(balance, cells, t);

        return (
          <li key={handlingUnit.id}>
            <Card className="flex flex-col gap-1 p-3">
              <TextLink
                className="self-start font-semibold tabular-nums wrap-anywhere"
                isFocusRequested
                to={{ kind: 'object', object: { id: handlingUnit.id, type: 'handling_unit' } }}
              >
                {handlingUnit.sscc}
              </TextLink>
              {cells.has(cellId)
                ? <TextLink size="sm" to={{ kind: 'object', object: { id: cellId, type: 'cell' } }}>{location}</TextLink>
                : <p className="text-sm text-on-panel-muted">{location}</p>}
              <WarehouseStockLines lines={balance.lines} productNames={productNames} t={t} />
            </Card>
          </li>
        );
      })}
    </ul>
  );
};

export const WarehouseMovements = ({
  balances, canViewDeals, cells, movements, productNames, t, warehouse,
}: WarehouseMovementsProps): ReactElement => {
  const { formatDateTime } = useI18n();
  const currentUnitIds = new Set(balances?.map(balance => balance.handlingUnit?.id));
  const readTime = (movement: StockMovement): number => movement.occurredAt === undefined ? 0 : timestampMs(movement.occurredAt);
  const sorted = movements.toSorted((current, prev) => readTime(prev) - readTime(current));

  return (
    <ol className="flex flex-col gap-3" data-testid="warehouse-movements">
      {sorted.map((movement) => {
        const { dealId, fromCellId, fromReceivingAreaId, handlingUnit, occurredAt, sourceDocumentNumber, toCellId, toReceivingAreaId }
          = movement;
        const fromCell = fromCellId === undefined ? undefined : cells.get(fromCellId);
        const toCell = cells.get(toCellId);
        const hasFrom = fromCell !== undefined || fromReceivingAreaId !== undefined;
        const hasTo = toCell !== undefined || toReceivingAreaId !== undefined;

        return (
          <li key={movement.id}>
            <Card className="flex flex-col gap-1.5 p-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-semibold">{readMovementKind(movement, t)}</p>
                {occurredAt !== undefined && (
                  <time className="text-sm text-on-panel-muted" dateTime={new Date(timestampMs(occurredAt)).toISOString()}>
                    {formatDateTime(timestampMs(occurredAt), { format: MOVEMENT_TIME_FORMAT, timeZone: warehouse.timeZone })}
                  </time>
                )}
              </div>
              {handlingUnit !== undefined && (
                currentUnitIds.has(handlingUnit.id)
                  ? (
                      <TextLink size="sm" to={{ kind: 'object', object: { id: handlingUnit.id, type: 'handling_unit' } }}>
                        {handlingUnit.sscc}
                      </TextLink>
                    )
                  : <p className="text-sm tabular-nums">{handlingUnit.sscc}</p>
              )}
              {(hasFrom || hasTo) && (
                <div className="flex flex-wrap items-center gap-x-2 text-sm">
                  {fromReceivingAreaId !== undefined && <span>{t('warehouseWork.receivingArea')}</span>}
                  {fromReceivingAreaId === undefined && fromCell !== undefined && fromCellId !== undefined && (
                    <TextLink size="sm" to={{ kind: 'object', object: { id: fromCellId, type: 'cell' } }}>{fromCell}</TextLink>
                  )}
                  {hasFrom && hasTo && <span aria-hidden="true">→</span>}
                  {toReceivingAreaId !== undefined && <span>{t('warehouseWork.receivingArea')}</span>}
                  {toReceivingAreaId === undefined && toCell !== undefined && (
                    <TextLink size="sm" to={{ kind: 'object', object: { id: toCellId, type: 'cell' } }}>{toCell}</TextLink>
                  )}
                </div>
              )}
              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                {sourceDocumentNumber !== '' && <p className="text-sm">{t('warehouseWork.reference', { number: sourceDocumentNumber })}</p>}
                {canViewDeals && dealId !== undefined && (
                  <TextLink size="sm" to={{ kind: 'object', object: { id: dealId, type: 'deal' } }}>
                    {t('warehouseWork.deal')}
                  </TextLink>
                )}
              </div>
              <WarehouseStockLines lines={movement.lines} productNames={productNames} t={t} />
            </Card>
          </li>
        );
      })}
    </ol>
  );
};
