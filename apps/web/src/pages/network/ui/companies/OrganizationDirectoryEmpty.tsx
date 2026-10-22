import type { ReactElement } from 'react';

import {
  BadgeCheck,
  Building2,
  SearchX,
} from 'lucide-react';

import { useI18n } from '@/shared/i18n';
import { Button } from '@/shared/ui';
import { ZoneEmptyState } from '@/widgets/hud-layout';

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
    return <ZoneEmptyState icon={BadgeCheck} text={t('organization.directory.level4Empty')} />;
  }

  if (!isFiltered) {
    return <ZoneEmptyState icon={Building2} text={t('organization.directory.empty')} />;
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3">
      <ZoneEmptyState icon={SearchX} text={t('organization.directory.emptyFiltered')} />
      <Button onClick={handleResetClick} variant="ghost">{t('organization.directory.reset')}</Button>
    </div>
  );
};
