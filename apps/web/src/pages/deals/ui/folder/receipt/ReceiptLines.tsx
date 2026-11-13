import type {
  Deal,
  ReceiptLineComparison,
} from '@skladburg/contracts/deal/v1/deal';
import type { ReactElement } from 'react';

import { BaseUnit } from '@skladburg/contracts/catalog/v1/catalog';

import { useI18n } from '@/shared/i18n';

import type { DealReceiptTranslate } from './dealReceiptSection';

const UNIT_KEYS = {
  [BaseUnit.GRAM]: 'dealReceipt.unit.gram',
  [BaseUnit.MILLILITER]: 'dealReceipt.unit.milliliter',
  [BaseUnit.PIECE]: 'dealReceipt.unit.piece',
  [BaseUnit.UNSPECIFIED]: 'dealReceipt.unit.unspecified',
} as const;

interface ReceiptLinesProps {
  deal: Deal;
  lines: readonly ReceiptLineComparison[];
  t: DealReceiptTranslate;
}

export const ReceiptLines = ({ deal, lines, t }: ReceiptLinesProps): ReactElement => {
  const { locale } = useI18n();
  const number = new Intl.NumberFormat(locale);
  const products = new Map(deal.lines.map(line => [line.id, line.productSnapshot]));

  return (
    <ul className="divide-y divide-line">
      {lines.map((line) => {
        const product = products.get(line.dealLineId);
        const unit = t(UNIT_KEYS[product?.baseUnit ?? BaseUnit.UNSPECIFIED]);
        const quantities = [
          [t('dealReceipt.ordered'), line.orderedQuantityBase],
          [t('dealReceipt.documented'), line.documentedQuantityBase],
          [t('dealReceipt.fact'), line.receivedQuantityBase],
          [t('dealReceipt.accepted'), line.acceptedQuantityBase],
        ] as const;
        const discrepancies = [
          [t('dealReceipt.shortage'), line.shortageQuantityBase, unit],
          [t('dealReceipt.excess'), line.excessQuantityBase, unit],
          [t('dealReceipt.defective'), line.defectiveQuantityBase, unit],
          [t('dealReceipt.missingMarks'), line.missingMarkingCount, ''],
          [t('dealReceipt.unexpectedMarks'), line.unexpectedMarkingCount, ''],
        ] as const;

        return (
          <li className="flex flex-col gap-1 py-2" data-testid="deal-receipt-line" key={line.dealLineId}>
            <p className="font-medium wrap-anywhere">{product?.name ?? t('dealReceipt.unknownProduct')}</p>
            <dl className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-2 gap-y-1 text-sm">
              {quantities.map(([label, value]) => (
                <div className="contents" key={label}>
                  <dt className="text-on-panel-muted">{label}</dt>
                  <dd className="text-right tabular-nums">
                    {number.format(value)}
                    {' '}
                    {unit}
                  </dd>
                </div>
              ))}
              {discrepancies.map(([label, value, suffix]) => value === 0n
                ? null
                : (
                    <div className="contents" key={label}>
                      <dt>{label}</dt>
                      <dd className="text-right font-semibold tabular-nums">
                        {number.format(value)}
                        {' '}
                        {suffix}
                      </dd>
                    </div>
                  ))}
            </dl>
          </li>
        );
      })}
    </ul>
  );
};
