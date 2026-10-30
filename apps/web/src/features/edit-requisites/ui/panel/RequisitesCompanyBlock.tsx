import type { ReactElement } from 'react';

import { useId } from 'react';

import { useActingOrganizationQuery } from '@/entities/organization';
import { useI18n } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';
import {
  Skeleton,
  WidgetStates,
} from '@/shared/ui';

import type { RequisitesTranslate } from '../../i18n/requisitesSection';

import { formatTimeZoneLabel } from '../../lib/formatTimeZoneLabel';
import { RequisitesProperty } from './RequisitesProperty';
import {
  REQUISITES_GROUP_HEADING_CLASS_NAME,
  REQUISITES_READ_ONLY_BLOCK_CLASS_NAME,
} from './requisitesStyles';

const COMPANY_FIELD_IDS = ['legalName', 'inn', 'kpp', 'ogrn', 'timeZone'] as const;

const COMPANY_LIST_CLASS_NAME = cn(REQUISITES_READ_ONLY_BLOCK_CLASS_NAME, 'flex flex-col gap-3');

const RequisitesCompanySkeleton = (): ReactElement => (
  <div className={COMPANY_LIST_CLASS_NAME}>
    {COMPANY_FIELD_IDS.map(fieldId => (
      <div className="flex flex-col" key={fieldId}>
        <div className="flex h-5 items-center">
          <Skeleton className="h-3.5 w-20" />
        </div>
        <div className="flex h-6 items-center">
          <Skeleton className="h-5 w-40" />
        </div>
      </div>
    ))}
  </div>
);

interface CompanyValueProps {
  value: string;
}

const CompanyValue = ({ value }: CompanyValueProps): ReactElement => {
  const { t } = useI18n();

  if (value === '') {
    return <span className="text-on-panel-muted">{t('organization.card.notSet')}</span>;
  }

  return <span translate="no">{value}</span>;
};

export interface RequisitesCompanyBlockProps {
  t: RequisitesTranslate;
  timeZone: string;
}

export const RequisitesCompanyBlock = ({ t, timeZone }: RequisitesCompanyBlockProps): ReactElement => {
  const { t: mainT } = useI18n();
  const headingId = useId();
  const {
    data: organization,
    error,
    isFetching,
    refetch,
  } = useActingOrganizationQuery();

  const handleRetry = (): void => {
    console.log('> RequisitesCompanyBlock -> handleRetry:', { hasError: error !== null });
    void refetch();
  };

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-4" data-testid="requisites-company">
      <h3 className={REQUISITES_GROUP_HEADING_CLASS_NAME} id={headingId}>
        {t('requisites.company.title')}
      </h3>
      <WidgetStates
        data={organization}
        error={error}
        isRetrying={isFetching}
        loadingLabel={mainT('organization.card.requisitesLoading')}
        onRetry={handleRetry}
        skeleton={<RequisitesCompanySkeleton />}
      >
        {loadedOrganization => (
          <dl className={COMPANY_LIST_CLASS_NAME}>
            <RequisitesProperty label={mainT('organization.card.legalName')}>
              <CompanyValue value={loadedOrganization.legalName} />
            </RequisitesProperty>
            <RequisitesProperty isNumeric label={mainT('organization.card.inn')}>
              <CompanyValue value={loadedOrganization.inn} />
            </RequisitesProperty>
            <RequisitesProperty isNumeric label={mainT('organization.card.kpp')}>
              <CompanyValue value={loadedOrganization.kpp} />
            </RequisitesProperty>
            <RequisitesProperty isNumeric label={mainT('organization.card.ogrn')}>
              <CompanyValue value={loadedOrganization.ogrn} />
            </RequisitesProperty>
            <RequisitesProperty label={t('requisites.company.timeZone')}>
              {t('requisites.company.timeZoneValue', { offset: formatTimeZoneLabel(timeZone), timeZone })}
            </RequisitesProperty>
          </dl>
        )}
      </WidgetStates>
    </section>
  );
};
