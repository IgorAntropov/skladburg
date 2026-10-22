import type {
  ChangeEvent,
  ReactElement,
} from 'react';

import { ProfileKind } from '@skladburg/contracts/organization/v1/organization';
import { useMemo } from 'react';

import {
  buildSphereTree,
  useSpheresQuery,
} from '@/entities/organization';
import { useI18n } from '@/shared/i18n';
import {
  Button,
  SelectField,
} from '@/shared/ui';

import type { OrganizationDirectoryFilterValue } from '../../model/organizationDirectoryFilter';

import { countActiveDirectoryFilters } from '../../lib/countActiveDirectoryFilters';

interface OrganizationDirectoryFiltersProps {
  filter: OrganizationDirectoryFilterValue;
  id?: string | undefined;
  onFilterChange: (filter: OrganizationDirectoryFilterValue) => void;
  onReset: () => void;
}

const SIDE_OPTIONS = [
  { kind: ProfileKind.SUPPLIER, labelKey: 'side.supplier' },
  { kind: ProfileKind.CUSTOMER, labelKey: 'side.customer' },
  { kind: ProfileKind.CARRIER, labelKey: 'side.carrier' },
] as const;

const MIN_LEVEL_OPTIONS = [1, 2, 3, 4] as const;

const BRANCH_MARK = '– ';

const toProfileKind = (value: string): ProfileKind => SIDE_OPTIONS.find(option => String(option.kind) === value)?.kind
  ?? ProfileKind.UNSPECIFIED;

const toMinVerificationLevel = (value: string): number => MIN_LEVEL_OPTIONS.find(level => String(level) === value) ?? 0;

export const OrganizationDirectoryFilters = ({
  filter,
  id,
  onFilterChange,
  onReset,
}: OrganizationDirectoryFiltersProps): ReactElement => {
  const { t } = useI18n();
  const spheresQuery = useSpheresQuery();

  const sphereOptions = useMemo(() => buildSphereTree(spheresQuery.data ?? []), [spheresQuery.data]);

  const isResetShown = countActiveDirectoryFilters(filter) > 0;

  const handleSideChange = (event: ChangeEvent<HTMLSelectElement>): void => {
    console.log('> OrganizationDirectoryFilters -> handleSideChange:', { value: event.target.value });
    onFilterChange({ ...filter, profileKind: toProfileKind(event.target.value) });
  };

  const handleSphereChange = (event: ChangeEvent<HTMLSelectElement>): void => {
    console.log('> OrganizationDirectoryFilters -> handleSphereChange:', { value: event.target.value });
    onFilterChange({ ...filter, sphereId: event.target.value });
  };

  const handleVerificationChange = (event: ChangeEvent<HTMLSelectElement>): void => {
    console.log('> OrganizationDirectoryFilters -> handleVerificationChange:', { value: event.target.value });
    onFilterChange({ ...filter, minVerificationLevel: toMinVerificationLevel(event.target.value) });
  };

  const handleResetClick = (): void => {
    console.log('> OrganizationDirectoryFilters -> handleResetClick:', {});
    onReset();
  };

  return (
    <div className="@container flex flex-col gap-3" data-testid="organization-directory-filters" id={id}>
      <div className="grid grid-cols-1 gap-3 @lg:grid-cols-[1fr_1.4fr_1fr]">
        <SelectField
          label={t('organization.directory.filter.side')}
          name="organization-side"
          onChange={handleSideChange}
          value={String(filter.profileKind || '')}
        >
          <option value="">{t('organization.directory.filter.any')}</option>
          {SIDE_OPTIONS.map(option => <option key={option.kind} value={option.kind}>{t(option.labelKey)}</option>)}
        </SelectField>
        <SelectField
          label={t('organization.directory.filter.sphere')}
          name="organization-sphere"
          onChange={handleSphereChange}
          value={filter.sphereId}
        >
          <option value="">{t('organization.directory.filter.any')}</option>
          {sphereOptions.map(option => (
            <option key={option.id} value={option.id}>{`${BRANCH_MARK.repeat(option.depth)}${option.name}`}</option>
          ))}
        </SelectField>
        <SelectField
          label={t('organization.directory.filter.verification')}
          name="organization-verification"
          onChange={handleVerificationChange}
          value={String(filter.minVerificationLevel || '')}
        >
          <option value="">{t('organization.directory.filter.any')}</option>
          {MIN_LEVEL_OPTIONS.map(level => (
            <option key={level} value={level}>{t('organization.directory.filter.minLevel', { level })}</option>
          ))}
        </SelectField>
      </div>
      {isResetShown && (
        <Button
          className="self-start"
          data-testid="organization-directory-reset"
          onClick={handleResetClick}
          size="md"
          variant="ghost"
        >
          {t('organization.directory.reset')}
        </Button>
      )}
    </div>
  );
};
