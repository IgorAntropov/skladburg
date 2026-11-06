import type { Money } from '@skladburg/contracts/common/v1/money';
import type { ReactElement } from 'react';

import { useI18n } from '@/shared/i18n';
import { formatMoney } from '@/shared/lib/money';

import type { DealInspectorTranslate } from '../../i18n/inspectorSection';

interface DealLimitReasonProps {
  amount: Money | undefined;
  limit: Money | undefined;
  t: DealInspectorTranslate;
}

export const DealLimitReason = ({ amount, limit, t }: DealLimitReasonProps): null | ReactElement => {
  const { locale } = useI18n();

  if (amount === undefined || limit === undefined) {
    return null;
  }

  const key = amount.currencyCode === limit.currencyCode ? 'dealInspector.limit' : 'dealInspector.limitCurrency';

  return (
    <p className="text-sm text-on-panel-muted" data-testid="deal-limit-reason" role="status">
      {t(key, { amount: formatMoney(locale, amount), limit: formatMoney(locale, limit) })}
    </p>
  );
};
