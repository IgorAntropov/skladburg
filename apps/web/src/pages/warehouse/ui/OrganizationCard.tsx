import type { ReactElement } from 'react';

import { useActingOrganizationQuery } from '@/entities/organization';
import { useI18n } from '@/shared/i18n';

import {
  CARD_CLASS_NAME,
  CARD_SKELETON_CLASS_NAME,
  createSkeletonLineClassName,
  ORGANIZATION_LEGAL_NAME_CLASS_NAME,
  ORGANIZATION_NAME_CLASS_NAME,
} from './cardStyles';
import { QueryErrorNotice } from './QueryErrorNotice';

export const OrganizationCard = (): ReactElement => {
  const { t } = useI18n();
  const {
    data: organization,
    error,
    isError,
    refetch,
  } = useActingOrganizationQuery();

  const isFailed = organization === undefined && isError;

  const handleRetry = (): void => {
    console.log('> OrganizationCard -> handleRetry:', { isFailed });
    void refetch();
  };

  if (organization !== undefined) {
    return (
      <section aria-label={t('warehouse.organization.title')} className={CARD_CLASS_NAME}>
        <h2 className={ORGANIZATION_NAME_CLASS_NAME} translate="no">
          {organization.name}
        </h2>
        <p className={ORGANIZATION_LEGAL_NAME_CLASS_NAME} translate="no">
          {organization.legalName}
        </p>
      </section>
    );
  }

  if (isFailed) {
    return <QueryErrorNotice error={error} onRetry={handleRetry} />;
  }

  return (
    <div aria-busy="true" aria-label={t('warehouse.organization.loading')} className={CARD_SKELETON_CLASS_NAME} role="status">
      <div aria-hidden="true" className={createSkeletonLineClassName(ORGANIZATION_NAME_CLASS_NAME)} />
      <div aria-hidden="true" className={createSkeletonLineClassName(ORGANIZATION_LEGAL_NAME_CLASS_NAME)} />
    </div>
  );
};
