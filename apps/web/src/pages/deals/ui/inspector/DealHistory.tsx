import type { Timestamp } from '@bufbuild/protobuf/wkt';
import type { Deal } from '@skladburg/contracts/deal/v1/deal';
import type { ReactElement } from 'react';

import { timestampMs } from '@bufbuild/protobuf/wkt';
import { ProfileKind } from '@skladburg/contracts/organization/v1/organization';

import {
  useCatalogSection,
  useI18n,
} from '@/shared/i18n';

import type { DealInspectorTranslate } from '../../i18n/inspectorSection';

import { dealsSection } from '../../i18n/dealsSection';
import { DEAL_STATUS_KEYS } from '../../lib/dealStatus';

interface DealHistoryProps {
  deal: Deal;
  t: DealInspectorTranslate;
}

export const DealHistory = ({ deal, t }: DealHistoryProps): null | ReactElement => {
  const { formatDateTime, userTimeZone } = useI18n();
  const { t: statusText } = useCatalogSection(dealsSection);

  if (statusText === undefined) {
    return null;
  }

  const formatTime = (at: Timestamp): string => formatDateTime(timestampMs(at), {
    format: { dateStyle: 'short', timeStyle: 'short' },
    timeZone: userTimeZone,
  });

  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-base font-semibold">{t('dealInspector.history')}</h3>
      <ol className="flex flex-col gap-2 text-sm">
        {deal.createdAt !== undefined && (
          <li className="rounded-lg bg-hover px-3 py-2">
            <p>{t('dealInspector.historyStart')}</p>
            <p className="text-on-panel-muted">{formatTime(deal.createdAt)}</p>
          </li>
        )}
        {deal.transitions.map((transition, index) => {
          const from = statusText(DEAL_STATUS_KEYS[transition.from]);
          const to = statusText(DEAL_STATUS_KEYS[transition.to]);
          const side = transition.actorSide === ProfileKind.CUSTOMER ? t('dealInspector.customer') : t('dealInspector.supplier');
          const label = transition.from === transition.to
            ? t('dealInspector.historyUpdated')
            : t('dealInspector.historyStatus', { from, to });
          return (
            <li className="rounded-lg bg-hover px-3 py-2 wrap-break-word" key={`${deal.id}-${String(index)}`}>
              <p>{label}</p>
              {transition.at !== undefined && <p className="text-on-panel-muted">{formatTime(transition.at)}</p>}
              <p className="text-on-panel-muted">{side}</p>
              {transition.actorRoleName !== '' && <p className="text-on-panel-muted">{transition.actorRoleName}</p>}
              {transition.reason !== '' && <p>{transition.reason}</p>}
            </li>
          );
        })}
      </ol>
    </section>
  );
};
