import type { ReactElement } from 'react';

import { SearchX } from 'lucide-react';

import { AssistantPortrait } from '@/entities/assistant';
import { useI18n } from '@/shared/i18n';
import {
  Button,
  EmptyState,
} from '@/shared/ui';

import type { OrganizationDirectoryFilterValue } from '../../model/organizationDirectoryFilter';

import { countActiveDirectoryFilters } from '../../lib/countActiveDirectoryFilters';

interface OrganizationDirectoryEmptyProps {
  filter: OrganizationDirectoryFilterValue;
  onReset: () => void;
}

const TOP_VERIFICATION_LEVEL = 4;

export const OrganizationDirectoryEmpty = ({ filter, onReset }: OrganizationDirectoryEmptyProps): ReactElement => {
  const { t } = useI18n();

  const isFiltered = countActiveDirectoryFilters(filter) > 0;
  const isTopLevelFilter = filter.minVerificationLevel === TOP_VERIFICATION_LEVEL;

  const handleResetClick = (): void => {
    console.log('> OrganizationDirectoryEmpty -> handleResetClick:', {});
    onReset();
  };

  if (isTopLevelFilter) {
    return <EmptyState media={<AssistantPortrait size="sm" />} text={t('organization.directory.level4Empty')} />;
  }

  if (!isFiltered) {
    return <EmptyState media={<AssistantPortrait size="sm" />} text={t('organization.directory.empty')} />;
  }

  return (
    <EmptyState
      action={<Button onClick={handleResetClick} variant="ghost">{t('organization.directory.reset')}</Button>}
      icon={SearchX}
      text={t('organization.directory.emptyFiltered')}
    />
  );
};
