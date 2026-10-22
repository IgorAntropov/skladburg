import type { ReactElement } from 'react';

import {
  ChevronDown,
  ChevronUp,
  Funnel,
  Table,
} from 'lucide-react';
import {
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';

import type { ObjectRefValue } from '@/shared/routing';

import {
  SIDE_BADGES,
  toOrganizationSide,
  useSpheresQuery,
} from '@/entities/organization';
import { useI18n } from '@/shared/i18n';
import { useViewportClass } from '@/shared/lib/viewport';
import {
  Button,
  WidgetStates,
} from '@/shared/ui';

import type { NetworkMapModelStateValue } from '../../api/useNetworkMapModel';
import type { OrganizationDirectoryRowValue } from '../../lib/buildOrganizationDirectoryRows';
import type { OrganizationDirectoryFilterValue } from '../../model/organizationDirectoryFilter';
import type { OrganizationDirectoryTableValue } from '../../model/useOrganizationDirectoryTable';

import { useOrganizationDirectory } from '../../api/directory/useOrganizationDirectory';
import { countActiveDirectoryFilters } from '../../lib/countActiveDirectoryFilters';
import { usePrewarmedModule } from '../../lib/usePrewarmedModule';
import { useTableButtonFocus } from '../../lib/useTableButtonFocus';
import { DEFAULT_ORGANIZATION_DIRECTORY_FILTER } from '../../model/organizationDirectoryFilter';
import { loadOrganizationInspector } from '../loadOrganizationInspector';
import { OrganizationDirectoryListSkeleton } from '../OrganizationDirectoryListSkeleton';
import { OrganizationDirectoryEmpty } from './OrganizationDirectoryEmpty';
import { OrganizationDirectoryFilters } from './OrganizationDirectoryFilters';
import { OrganizationDirectoryList } from './OrganizationDirectoryList';

interface NetworkCompaniesPanelProps {
  filter: OrganizationDirectoryFilterValue;
  focus: ObjectRefValue | undefined;
  onFilterChange: (filter: OrganizationDirectoryFilterValue) => void;
  state: NetworkMapModelStateValue;
  table: OrganizationDirectoryTableValue;
}

const TABLE_BUTTON_CLASS_NAME = 'w-11 px-0! @min-[21rem]:w-auto @min-[21rem]:px-4!';

const COUNT_CLASS_NAME = 'inline-block min-w-6 rounded-full bg-skeleton px-2 text-center text-sm text-on-panel tabular-nums';

const isRowsEmpty = (rows: readonly OrganizationDirectoryRowValue[]): boolean => rows.length === 0;

export const NetworkCompaniesPanel = ({
  filter,
  focus,
  onFilterChange,
  state,
  table,
}: NetworkCompaniesPanelProps): ReactElement => {
  const { t } = useI18n();
  const viewportClass = useViewportClass();
  const setTableButtonRef = useTableButtonFocus(table.isOpen);
  const directory = useOrganizationDirectory(filter, state);
  const spheresQuery = useSpheresQuery();
  usePrewarmedModule(loadOrganizationInspector);
  const filtersId = useId();
  const toggleRef = useRef<HTMLButtonElement>(null);
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);

  const isTableButtonShown = viewportClass !== 'phone';
  const activeFilterCount = countActiveDirectoryFilters(filter);
  const isSummaryShown = !isFiltersOpen && activeFilterCount > 0;

  const summary = useMemo(() => {
    const side = toOrganizationSide(filter.profileKind);
    const sphereName = spheresQuery.data?.find(sphere => sphere.id === filter.sphereId)?.name;

    return [
      side === undefined ? undefined : t(SIDE_BADGES[side].labelKey),
      sphereName,
      filter.minVerificationLevel > 0
        ? t('organization.directory.summary.verification', { level: filter.minVerificationLevel })
        : undefined,
    ].filter(part => part !== undefined).join(' · ');
  }, [filter, spheresQuery.data, t]);

  const handleFiltersToggle = (): void => {
    console.log('> NetworkCompaniesPanel -> handleFiltersToggle:', { isFiltersOpen });
    setIsFiltersOpen(current => !current);
  };

  const handleTableOpenClick = (): void => {
    console.log('> NetworkCompaniesPanel -> handleTableOpenClick:', { isOpen: table.isOpen });
    table.open();
  };

  const handleReset = (): void => {
    console.log('> NetworkCompaniesPanel -> handleReset:', {});
    onFilterChange(DEFAULT_ORGANIZATION_DIRECTORY_FILTER);
    toggleRef.current?.focus();
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3" data-testid="network-companies-panel">
      <div className="@container flex min-h-11 items-center justify-between gap-2">
        <Button
          aria-controls={isFiltersOpen ? filtersId : undefined}
          aria-expanded={isFiltersOpen}
          data-testid="organization-directory-filters-toggle"
          onClick={handleFiltersToggle}
          ref={toggleRef}
          variant="neutral"
        >
          <Funnel aria-hidden className="size-4 text-on-panel-muted" />
          {t('organization.directory.filters')}
          {activeFilterCount > 0 && (
            <>
              <span aria-hidden className={COUNT_CLASS_NAME}>{activeFilterCount}</span>
              <span className="sr-only">{t('organization.directory.filtersActive', { count: activeFilterCount })}</span>
            </>
          )}
          {isFiltersOpen ? <ChevronUp aria-hidden className="size-4" /> : <ChevronDown aria-hidden className="size-4" />}
        </Button>
        {isTableButtonShown && (
          <Button
            aria-controls={table.isOpen ? table.panelId : undefined}
            aria-expanded={table.isOpen}
            aria-label={t('organization.directory.table.open')}
            className={TABLE_BUTTON_CLASS_NAME}
            data-testid="organization-directory-table-button"
            onClick={handleTableOpenClick}
            ref={setTableButtonRef}
            title={t('organization.directory.table.open')}
            variant="secondary"
          >
            <Table aria-hidden className="size-5" />
            <span aria-hidden className="hidden @min-[21rem]:inline">{t('organization.directory.table.open')}</span>
          </Button>
        )}
      </div>
      {isSummaryShown && <p className="shrink-0 truncate text-sm leading-5 text-on-panel-muted">{summary}</p>}
      {isFiltersOpen && (
        <OrganizationDirectoryFilters
          filter={filter}
          id={filtersId}
          onFilterChange={onFilterChange}
          onReset={handleReset}
        />
      )}
      <WidgetStates
        data={directory.data}
        empty={<OrganizationDirectoryEmpty filter={filter} onReset={handleReset} />}
        error={directory.error}
        isEmpty={isRowsEmpty}
        isRetrying={directory.isRetrying}
        loadingLabel={t('organization.directory.loading')}
        onRetry={directory.retry}
        skeleton={<OrganizationDirectoryListSkeleton />}
      >
        {rows => (
          <OrganizationDirectoryList
            focus={focus}
            isBusy={directory.isPlaceholderData}
            isViewerUnverified={directory.isViewerUnverified}
            rows={rows}
          />
        )}
      </WidgetStates>
    </div>
  );
};
