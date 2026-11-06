import type { SalesTerms } from '@skladburg/contracts/catalog/v1/catalog';
import type {
  ReactElement,
  ReactNode,
} from 'react';

import { useId } from 'react';

import { useI18n } from '@/shared/i18n';
import { formatMoney } from '@/shared/lib/money';

import type { EditLauncherValue } from '../../model/useEditLauncher';

import { useCatalogTexts } from '../../model/useCatalogTexts';
import { EditLauncherButton } from '../EditLauncherButton';

interface SalesTermsSummaryProps {
  launcher: EditLauncherValue<unknown>;
  terms: SalesTerms;
}

interface TermProps {
  children: ReactNode;
  label: string;
}

const Term = ({ children, label }: TermProps): ReactElement => (
  <div className="flex justify-between gap-3 @lg:flex-col @lg:justify-start @lg:gap-0">
    <dt className="text-sm leading-5 text-on-panel-muted">{label}</dt>
    <dd className="text-right text-base leading-6 text-on-panel tabular-nums @lg:text-left">{children}</dd>
  </div>
);

export const SalesTermsSummary = ({ launcher, terms }: SalesTermsSummaryProps): ReactElement => {
  const { locale } = useI18n();
  const { t } = useCatalogTexts();
  const titleId = useId();

  const pricePerKm = terms.ownDelivery?.pricePerKm;
  const minimumCharge = terms.ownDelivery?.minimumCharge;

  const deliveryText = pricePerKm === undefined || minimumCharge === undefined
    ? t('catalog.terms.deliveryNone')
    : t('catalog.terms.deliveryOwn', {
        minimum: formatMoney(locale, minimumCharge),
        price: formatMoney(locale, pricePerKm),
      });
  const preparationText = terms.preparationWorkingDays === 0
    ? t('catalog.terms.preparationSameDay')
    : t('catalog.terms.preparationDays', { count: terms.preparationWorkingDays });
  const autoConfirmText = terms.isAutoConfirmEnabled ? t('catalog.terms.autoConfirmOn') : t('catalog.terms.autoConfirmOff');

  return (
    <section
      aria-labelledby={titleId}
      className="@container flex flex-col gap-3 rounded-control border border-line p-3"
      data-testid="sales-terms-card"
    >
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <h2 className="text-base leading-6 font-semibold text-on-panel" id={titleId}>{t('catalog.terms.title')}</h2>
        <EditLauncherButton
          data-testid="sales-terms-edit"
          failureMessage={t('catalog.terms.openError')}
          label={t('catalog.terms.edit')}
          launcher={launcher}
        />
      </div>
      <dl className="grid grid-cols-1 gap-2 @lg:grid-cols-3 @lg:gap-3">
        <Term label={t('catalog.terms.delivery')}>{deliveryText}</Term>
        <Term label={t('catalog.terms.preparation')}>{preparationText}</Term>
        <Term label={t('catalog.terms.autoConfirm')}>{autoConfirmText}</Term>
      </dl>
    </section>
  );
};
