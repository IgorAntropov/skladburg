import type {
  Deal,
  DealLine,
  ReceiptLineComparison,
} from '@skladburg/contracts/deal/v1/deal';
import type { DocumentContent } from '@skladburg/contracts/document/v1/document';
import type { ReactElement } from 'react';

import { BaseUnit } from '@skladburg/contracts/catalog/v1/catalog';
import { DeliveryMethod } from '@skladburg/contracts/catalog/v1/showcase';

import {
  useCatalogSection,
  useI18n,
} from '@/shared/i18n';
import { formatMoney } from '@/shared/lib/money';
import {
  ErrorNotice,
  Skeleton,
  SkeletonGroup,
  TextLink,
} from '@/shared/ui';

import type { DealDocumentTranslate } from './documentSection';

import { dealReceiptSection } from '../receipt/dealReceiptSection';
import { ReceiptLines } from '../receipt/ReceiptLines';
import { DocumentFact } from './DocumentFact';

const DELIVERY_KEYS = {
  [DeliveryMethod.CUSTOMER]: 'dealDocument.deliveryCustomer',
  [DeliveryMethod.EXCHANGE]: 'dealDocument.deliveryExchange',
  [DeliveryMethod.SUPPLIER]: 'dealDocument.deliverySupplier',
  [DeliveryMethod.UNSPECIFIED]: 'dealDocument.notSpecified',
} as const;

const UNIT_KEYS = {
  [BaseUnit.GRAM]: 'dealDocument.unit.gram',
  [BaseUnit.MILLILITER]: 'dealDocument.unit.milliliter',
  [BaseUnit.PIECE]: 'dealDocument.unit.piece',
  [BaseUnit.UNSPECIFIED]: 'dealDocument.unit.unknown',
} as const;

interface DocumentLinesProps {
  lines: readonly DealLine[];
  t: DealDocumentTranslate;
}

const DocumentLines = ({ lines, t }: DocumentLinesProps): ReactElement => {
  const { locale } = useI18n();
  const numberFormat = new Intl.NumberFormat(locale);

  return (
    <ul className="divide-y divide-line">
      {lines.map(({ amount, id, price, priceUnitCoefficient, productSnapshot, quantity }) => {
        const unitKey = UNIT_KEYS[productSnapshot?.baseUnit ?? BaseUnit.UNSPECIFIED];
        const unit = t(unitKey);
        const priceLabel = t('dealDocument.linePrice', { quantity: numberFormat.format(priceUnitCoefficient), unit });

        return (
          <li className="flex flex-col gap-1 py-2" key={id}>
            <p className="font-medium wrap-anywhere">{productSnapshot?.name ?? t('dealDocument.notSpecified')}</p>
            <dl className="flex flex-col gap-1 text-sm">
              <DocumentFact
                label={t('dealDocument.lineQuantity')}
                value={t('dealDocument.lineQuantityValue', { quantity: numberFormat.format(quantity), unit })}
              />
              <DocumentFact label={priceLabel} value={price === undefined ? undefined : formatMoney(locale, price)} />
              <DocumentFact label={t('dealDocument.lineAmount')} value={amount === undefined ? undefined : formatMoney(locale, amount)} />
            </dl>
          </li>
        );
      })}
    </ul>
  );
};

interface DocumentTermsProps {
  deal: Deal;
  t: DealDocumentTranslate;
  terms: DocumentContent['terms'];
}

export const DocumentTerms = ({ deal, t, terms }: DocumentTermsProps): null | ReactElement => {
  const { formatCalendarDate, formatNumber, locale } = useI18n();

  if (terms.case === 'supplyContract') {
    const { acceptanceTerms, paymentTerms, templateVersion } = terms.value;
    const payment = paymentTerms === 'safe_deal_prepayment' ? t('dealDocument.safeDealPrepayment') : t('dealDocument.notSpecified');
    const acceptance = acceptanceTerms === 'acceptance_by_customer'
      ? t('dealDocument.acceptanceByCustomer')
      : t('dealDocument.notSpecified');

    return (
      <section className="flex flex-col gap-2">
        <h4 className="font-semibold">{t('dealDocument.terms')}</h4>
        <dl className="flex flex-col gap-1 text-sm">
          <DocumentFact label={t('dealDocument.templateVersion')} value={formatNumber(templateVersion)} />
          <DocumentFact label={t('dealDocument.paymentTerms')} value={payment} />
          <DocumentFact label={t('dealDocument.acceptanceTerms')} value={acceptance} />
        </dl>
      </section>
    );
  }

  if (terms.case !== 'invoice' && terms.case !== 'specification') {
    return <WarehouseDocumentTerms deal={deal} t={t} terms={terms} />;
  }

  const { deliveryTotal, goodsTotal, lines } = terms.value;
  const total = terms.case === 'invoice' ? terms.value.total : undefined;
  const specification = terms.case === 'specification' ? terms.value : undefined;

  return (
    <section className="flex flex-col gap-2">
      <h4 className="font-semibold">{t('dealDocument.positions')}</h4>
      <DocumentLines lines={lines} t={t} />
      <dl className="flex flex-col gap-1 border-t border-line pt-2 text-sm">
        <DocumentFact label={t('dealDocument.goodsTotal')} value={goodsTotal === undefined ? undefined : formatMoney(locale, goodsTotal)} />
        <DocumentFact
          label={t('dealDocument.deliveryTotal')}
          value={deliveryTotal === undefined ? undefined : formatMoney(locale, deliveryTotal)}
        />
        <DocumentFact label={t('dealDocument.total')} value={total === undefined ? undefined : formatMoney(locale, total)} />
      </dl>
      {specification !== undefined && (
        <dl className="flex flex-col gap-1 border-t border-line pt-2 text-sm">
          <DocumentFact
            label={t('dealDocument.delivery')}
            value={t(DELIVERY_KEYS[specification.deliveryMethod])}
          />
          <DocumentFact
            label={t('dealDocument.desiredDate')}
            value={specification.desiredDate === undefined ? undefined : formatCalendarDate(specification.desiredDate)}
          />
          <DocumentFact label={t('dealDocument.shipFrom')} value={specification.shipFromWarehouseId} />
          <DocumentFact label={t('dealDocument.shipTo')} value={specification.shipToWarehouseId} />
        </dl>
      )}
    </section>
  );
};

const WarehouseDocumentTerms = ({ deal, t, terms }: DocumentTermsProps): null | ReactElement => {
  const { locale } = useI18n();

  if (terms.case === 'upd') {
    const number = new Intl.NumberFormat(locale);
    const products = new Map(deal.lines.map(line => [line.id, line.productSnapshot]));

    return (
      <section className="flex flex-col gap-2">
        <h4 className="font-semibold">{t('dealDocument.positions')}</h4>
        <ul className="divide-y divide-line">
          {terms.value.lines.map(({ dealLineId, productName, quantityBase }) => (
            <li className="flex flex-wrap justify-between gap-x-2 py-2" key={dealLineId}>
              <span className="wrap-anywhere">{productName}</span>
              <span className="font-medium tabular-nums">
                {number.format(quantityBase)}
                {' '}
                {t(UNIT_KEYS[products.get(dealLineId)?.baseUnit ?? BaseUnit.UNSPECIFIED])}
              </span>
            </li>
          ))}
        </ul>
      </section>
    );
  }
  if (terms.case === 'receiptClaim') {
    const { discrepancyActDocumentId, disputedGoodsAmount } = terms.value;

    return (
      <div className="flex flex-col items-start gap-1">
        <dl className="w-full text-sm">
          <DocumentFact
            label={t('dealDocument.disputedGoods')}
            value={disputedGoodsAmount === undefined ? undefined : formatMoney(locale, disputedGoodsAmount)}
          />
        </dl>
        <RelatedDocumentLink id={discrepancyActDocumentId} label={t('dealDocument.relatedAct')} />
      </div>
    );
  }
  if (terms.case === 'dispatchTitle') {
    return <RelatedDocumentLink id={terms.value.updDocumentId} label={t('dealDocument.relatedUpd')} />;
  }
  if (terms.case === 'receiptTitle' || terms.case === 'receiptDiscrepancyAct') {
    return (
      <div className="flex flex-col items-start gap-1">
        <RelatedDocumentLink id={terms.value.updDocumentId} label={t('dealDocument.relatedUpd')} />
        <WarehouseDocumentLines deal={deal} lines={terms.value.lines} />
      </div>
    );
  }
  return null;
};

interface RelatedDocumentLinkProps {
  id: string;
  label: string;
}

const RelatedDocumentLink = ({ id, label }: RelatedDocumentLinkProps): null | ReactElement =>
  id === '' ? null : <TextLink isFocusRequested size="sm" to={{ kind: 'object', object: { id, type: 'document' } }}>{label}</TextLink>;

interface WarehouseDocumentLinesProps {
  deal: Deal;
  lines: readonly ReceiptLineComparison[];
}

const WarehouseDocumentLines = ({ deal, lines }: WarehouseDocumentLinesProps): ReactElement => {
  const { t: baseText } = useI18n();
  const { retry, status, t } = useCatalogSection(dealReceiptSection);
  if (t === undefined) {
    return status === 'error'
      ? <ErrorNotice error={null} onRetry={retry} />
      : <SkeletonGroup isFilled label={baseText('routing.section.loading')}><Skeleton className="h-16" /></SkeletonGroup>;
  }
  return <div className="w-full"><ReceiptLines deal={deal} lines={lines} t={t} /></div>;
};
