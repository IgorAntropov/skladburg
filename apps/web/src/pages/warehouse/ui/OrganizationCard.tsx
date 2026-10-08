import type { ReactElement } from 'react';

import { useActingOrganizationQuery } from '@/entities/organization';
import { useI18n } from '@/shared/i18n';
import {
  Card,
  Skeleton,
  WidgetStates,
} from '@/shared/ui';

import {
  ORGANIZATION_LEGAL_NAME_CLASS_NAME,
  ORGANIZATION_LEGAL_NAME_SKELETON_CLASS_NAME,
  ORGANIZATION_NAME_CLASS_NAME,
  ORGANIZATION_NAME_SKELETON_CLASS_NAME,
} from './cardStyles';

export const OrganizationCard = (): ReactElement => {
  const { t } = useI18n();
  const {
    data: organization,
    error,
    isFetching,
    refetch,
  } = useActingOrganizationQuery();

  const handleRetry = (): void => {
    console.log('> OrganizationCard -> handleRetry:', { hasError: error !== null });
    void refetch();
  };

  const skeleton = (
    <Card>
      <Skeleton className={ORGANIZATION_NAME_SKELETON_CLASS_NAME} />
      <Skeleton className={ORGANIZATION_LEGAL_NAME_SKELETON_CLASS_NAME} />
    </Card>
  );

  return (
    <WidgetStates
      data={organization}
      error={error}
      isRetrying={isFetching}
      loadingLabel={t('warehouse.organization.loading')}
      onRetry={handleRetry}
      skeleton={skeleton}
    >
      {loadedOrganization => (
        <section aria-label={t('warehouse.organization.title')}>
          <Card>
            <h2 className={ORGANIZATION_NAME_CLASS_NAME} translate="no">
              {loadedOrganization.name}
            </h2>
            <p className={ORGANIZATION_LEGAL_NAME_CLASS_NAME} translate="no">
              {loadedOrganization.legalName}
            </p>
          </Card>
        </section>
      )}
    </WidgetStates>
  );
};
