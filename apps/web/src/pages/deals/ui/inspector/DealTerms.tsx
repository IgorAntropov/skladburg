import type { CalendarDate } from '@skladburg/contracts/common/v1/date';
import type { Money } from '@skladburg/contracts/common/v1/money';
import type {
  Deal,
  DealLine,
} from '@skladburg/contracts/deal/v1/deal';
import type { ReactElement } from 'react';

import { DeliveryMethod } from '@skladburg/contracts/catalog/v1/showcase';

import {
  useMapSitesQuery,
  useNetworkDirectoryQuery,
} from '@/entities/network';
import { useI18n } from '@/shared/i18n';
import { formatMoney } from '@/shared/lib/money';

import type { DealInspectorTranslate } from '../../i18n/inspectorSection';

import {
  dealLinePriceBasis,
  dealLineUnit,
} from './dealLineLabels';

const DELIVERY_LABELS = {
  [DeliveryMethod.CUSTOMER]: 'dealInspector.deliveryCustomer',
  [DeliveryMethod.EXCHANGE]: 'dealInspector.deliveryExchange',
  [DeliveryMethod.SUPPLIER]: 'dealInspector.deliverySupplier',
  [DeliveryMethod.UNSPECIFIED]: 'dealInspector.notSpecified',
} as const;

interface DealTermsProps {
  deal: Deal;
  t: DealInspectorTranslate;
}

interface TermsValuesProps {
  date: CalendarDate | undefined;
  goodsTotal: Money | undefined;
  isCounter?: boolean | undefined;
  lines: readonly DealLine[];
  shipFromName: string | undefined;
  t: DealInspectorTranslate;
}

const TermsValues = ({ date, goodsTotal, isCounter = false, lines, shipFromName, t }: TermsValuesProps): ReactElement => {
  const { formatCalendarDate, locale } = useI18n();
  const format = new Intl.NumberFormat(locale);
  const missing = t('dealInspector.notSpecified');

  return (
    <>
      <ul className="flex flex-col gap-2">
        {lines.map(line => (
          <li className="rounded-lg bg-hover px-3 py-2 wrap-break-word" key={line.id}>
            <div className="font-medium">{line.productSnapshot?.name ?? missing}</div>
            <dl className="mt-1 flex flex-col gap-1 text-sm text-on-panel-muted">
              <div>
                <dt className="sr-only">{t('dealInspector.quantity', { unit: dealLineUnit(line, t) })}</dt>
                <dd>{t('dealInspector.priceBasis', { quantity: format.format(line.quantity), unit: dealLineUnit(line, t) })}</dd>
              </div>
              {line.price !== undefined && (
                <div className="flex flex-wrap justify-between gap-x-2">
                  <dt>{t('dealInspector.price', { unit: dealLinePriceBasis(line, format, t) })}</dt>
                  <dd>{formatMoney(locale, line.price)}</dd>
                </div>
              )}
              {line.amount !== undefined && (
                <div className="flex flex-wrap justify-between gap-x-2">
                  <dt>{t('dealInspector.lineTotal')}</dt>
                  <dd>{formatMoney(locale, line.amount)}</dd>
                </div>
              )}
            </dl>
          </li>
        ))}
      </ul>
      <dl className="flex flex-col gap-1 text-sm">
        <DealFact label={t('dealInspector.date')} value={date === undefined ? missing : formatCalendarDate(date)} />
        <DealFact label={t('dealInspector.shipFrom')} value={shipFromName ?? missing} />
        {goodsTotal !== undefined && (
          <DealFact
            label={t('dealInspector.goodsTotal')}
            testId={isCounter ? undefined : 'deal-goods-total'}
            value={formatMoney(locale, goodsTotal)}
          />
        )}
      </dl>
    </>
  );
};

interface DealFactProps {
  label: string;
  testId?: string | undefined;
  value: string;
}

const DealFact = ({ label, testId, value }: DealFactProps): ReactElement => (
  <div className="flex flex-wrap justify-between gap-x-2 wrap-break-word">
    <dt className="text-on-panel-muted">{label}</dt>
    <dd className="font-medium" data-testid={testId}>{value}</dd>
  </div>
);

export const DealTerms = ({ deal, t }: DealTermsProps): ReactElement => {
  const { locale } = useI18n();
  const { data: sites } = useMapSitesQuery();
  const { data: directory } = useNetworkDirectoryQuery();
  const offer = deal.counterOffer;
  const city = directory?.cities.find(item => item.id === deal.shipFromCityId);
  const getWarehouseLabel = (id: string | undefined): string | undefined => {
    const site = sites?.find(item => item.id === id);
    if (site === undefined) {
      return undefined;
    }

    return site.name || directory?.cities.find(item => item.id === site.cityId)?.name;
  };
  const shipToName = getWarehouseLabel(deal.shipToWarehouseId);
  const shipFromName = getWarehouseLabel(deal.shipFromWarehouseId);
  const offerWarehouseName = getWarehouseLabel(offer?.shipFromWarehouseId);
  const missing = t('dealInspector.notSpecified');

  return (
    <>
      <section className="flex flex-col gap-2">
        <h3 className="text-base font-semibold">{t('dealInspector.terms')}</h3>
        <dl className="flex flex-col gap-1 text-sm">
          <DealFact label={t('dealInspector.shipCity')} value={city?.name ?? missing} />
          <DealFact label={t('dealInspector.shipTo')} value={shipToName ?? missing} />
          {deal.deliveryMethod !== DeliveryMethod.UNSPECIFIED && (
            <DealFact label={t('dealInspector.delivery')} value={t(DELIVERY_LABELS[deal.deliveryMethod])} />
          )}
          {deal.deliveryTotal !== undefined && (
            <DealFact label={t('dealInspector.deliveryTotal')} value={formatMoney(locale, deal.deliveryTotal)} />
          )}
        </dl>
        <TermsValues date={deal.desiredDate} goodsTotal={deal.goodsTotal} lines={deal.lines} shipFromName={shipFromName} t={t} />
      </section>
      {offer !== undefined && (
        <section className="flex flex-col gap-2">
          <h3 className="text-base font-semibold">{t('dealInspector.offer')}</h3>
          <TermsValues
            date={offer.desiredDate}
            goodsTotal={offer.goodsTotal}
            isCounter
            lines={offer.lines}
            shipFromName={offerWarehouseName}
            t={t}
          />
          {offer.reason !== '' && <p className="text-sm wrap-break-word">{offer.reason}</p>}
        </section>
      )}
    </>
  );
};
