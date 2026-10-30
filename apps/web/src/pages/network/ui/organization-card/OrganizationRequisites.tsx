import type {
  ReactElement,
  Ref,
} from 'react';

import { Lock } from 'lucide-react';
import { useId } from 'react';

import { useActingOrganizationQuery } from '@/entities/organization';
import { useRequisitesView } from '@/features/edit-requisites';
import { useI18n } from '@/shared/i18n';
import {
  Button,
  Skeleton,
  WidgetStates,
} from '@/shared/ui';

import { InspectorProperty } from '../inspector/InspectorProperty';

interface RequisiteValueProps {
  isNumeric?: boolean | undefined;
  value: string;
}

const NUMERIC_CLASS_NAME = 'tabular-nums break-all';

export interface OrganizationRequisitesProps {
  ref?: Ref<HTMLButtonElement> | undefined;
}

const REQUISITE_SKELETON_IDS = ['legalName', 'inn', 'kpp', 'ogrn'] as const;

const RequisiteValue = ({ isNumeric = false, value }: RequisiteValueProps): ReactElement => {
  const { t } = useI18n();

  if (value === '') {
    return <span className="text-on-panel-muted">{t('organization.card.notSet')}</span>;
  }

  return <span className={isNumeric ? NUMERIC_CLASS_NAME : undefined} translate="no">{value}</span>;
};

const RequisitesSkeleton = (): ReactElement => (
  <div className="flex flex-col gap-3">
    {REQUISITE_SKELETON_IDS.map(requisiteId => (
      <div className="flex flex-col" key={requisiteId}>
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

export const OrganizationRequisites = ({ ref }: OrganizationRequisitesProps): ReactElement => {
  const { t } = useI18n();
  const headingId = useId();
  const {
    data: organization,
    error,
    isFetching,
    refetch,
  } = useActingOrganizationQuery();
  const { open: openRequisites } = useRequisitesView();

  const handleRequisitesOpenClick = (): void => {
    console.log('> OrganizationRequisites -> handleRequisitesOpenClick:', {});
    openRequisites();
  };

  const handleRetry = (): void => {
    console.log('> OrganizationRequisites -> handleRetry:', { hasError: error !== null });
    void refetch();
  };

  return (
    <section
      aria-labelledby={headingId}
      className="flex flex-col gap-3 rounded-control border border-line p-3"
      data-testid="organization-requisites"
    >
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <Lock aria-hidden className="size-4 shrink-0 text-on-panel-muted" />
          <h3 className="text-sm leading-5 font-semibold text-on-panel" id={headingId}>
            {t('organization.card.requisites')}
          </h3>
        </div>
        <p className="text-sm leading-5 text-on-panel-muted">{t('organization.card.requisitesNote')}</p>
      </div>
      <WidgetStates
        data={organization}
        error={error}
        isRetrying={isFetching}
        loadingLabel={t('organization.card.requisitesLoading')}
        onRetry={handleRetry}
        skeleton={<RequisitesSkeleton />}
      >
        {loadedOrganization => (
          <dl className="flex flex-col gap-3">
            <InspectorProperty label={t('organization.card.legalName')}>
              <RequisiteValue value={loadedOrganization.legalName} />
            </InspectorProperty>
            <InspectorProperty label={t('organization.card.inn')}>
              <RequisiteValue isNumeric value={loadedOrganization.inn} />
            </InspectorProperty>
            <InspectorProperty label={t('organization.card.kpp')}>
              <RequisiteValue isNumeric value={loadedOrganization.kpp} />
            </InspectorProperty>
            <InspectorProperty label={t('organization.card.ogrn')}>
              <RequisiteValue isNumeric value={loadedOrganization.ogrn} />
            </InspectorProperty>
          </dl>
        )}
      </WidgetStates>
      <Button
        className="self-start"
        data-testid="organization-requisites-open"
        onClick={handleRequisitesOpenClick}
        ref={ref}
        variant="secondary"
      >
        {t('organization.card.requisitesOpen')}
      </Button>
    </section>
  );
};
