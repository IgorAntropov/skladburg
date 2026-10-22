import type {
  KeyboardEvent,
  ReactElement,
} from 'react';

import { X } from 'lucide-react';
import {
  useEffect,
  useId,
  useRef,
} from 'react';

import type { ObjectRefValue } from '@/shared/routing';

import { useI18n } from '@/shared/i18n';
import {
  Button,
  WidgetStates,
} from '@/shared/ui';

import type { NetworkMapModelStateValue } from '../../api/useNetworkMapModel';
import type { OrganizationDirectoryFilterValue } from '../../model/organizationDirectoryFilter';

import { useOrganizationDirectory } from '../../api/directory/useOrganizationDirectory';
import { usePrewarmedModule } from '../../lib/usePrewarmedModule';
import { DEFAULT_ORGANIZATION_DIRECTORY_FILTER } from '../../model/organizationDirectoryFilter';
import { OrganizationDirectoryEmpty } from '../companies/OrganizationDirectoryEmpty';
import { OrganizationDirectoryFilters } from '../companies/OrganizationDirectoryFilters';
import { OrganizationDirectoryUnverifiedNote } from '../companies/OrganizationDirectoryUnverifiedNote';
import { loadOrganizationInspector } from '../loadOrganizationInspector';
import { OrganizationDirectoryTable } from './OrganizationDirectoryTable';
import { OrganizationDirectoryTableSkeleton } from './OrganizationDirectoryTableSkeleton';

interface OrganizationDirectoryPanelProps {
  filter: OrganizationDirectoryFilterValue;
  focus: ObjectRefValue | undefined;
  onClose: () => void;
  onFilterChange: (filter: OrganizationDirectoryFilterValue) => void;
  panelId: string;
  state: NetworkMapModelStateValue;
}

const FIRST_FIELD_SELECTOR = 'select:not([disabled])';

export const OrganizationDirectoryPanel = ({
  filter,
  focus,
  onClose,
  onFilterChange,
  panelId,
  state,
}: OrganizationDirectoryPanelProps): ReactElement => {
  const { t } = useI18n();
  const directory = useOrganizationDirectory(filter, state);
  usePrewarmedModule(loadOrganizationInspector);
  const titleId = useId();
  const panelRef = useRef<HTMLElement>(null);

  const selectedOrganizationId = focus?.type === 'organization' ? focus.id : undefined;

  const handleReset = (): void => {
    console.log('> OrganizationDirectoryPanel -> handleReset:', {});
    onFilterChange(DEFAULT_ORGANIZATION_DIRECTORY_FILTER);
    panelRef.current?.querySelector<HTMLElement>(FIRST_FIELD_SELECTOR)?.focus();
  };

  const handleCloseClick = (): void => {
    console.log('> OrganizationDirectoryPanel -> handleCloseClick:', {});
    onClose();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>): void => {
    if (event.key !== 'Escape' || event.defaultPrevented) {
      return;
    }

    console.log('> OrganizationDirectoryPanel -> handleKeyDown:', { key: event.key });
    onClose();
  };

  useEffect(() => {
    panelRef.current?.querySelector<HTMLElement>(FIRST_FIELD_SELECTOR)?.focus();
  }, []);

  return (
    <section
      aria-labelledby={titleId}
      className="@container flex flex-col gap-6"
      data-testid="organization-directory-panel"
      id={panelId}
      onKeyDown={handleKeyDown}
      ref={panelRef}
    >
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-2xl font-semibold tracking-tight text-balance" id={titleId}>
          {t('organization.directory.table.title')}
        </h2>
        <Button data-testid="organization-directory-close" onClick={handleCloseClick} variant="ghost">
          <X aria-hidden className="size-5" />
          {t('organization.directory.close')}
        </Button>
      </div>
      <div className="flex flex-col gap-4">
        <OrganizationDirectoryFilters filter={filter} onFilterChange={onFilterChange} onReset={handleReset} />
        <WidgetStates
          data={directory.data}
          error={directory.error}
          isRetrying={directory.isRetrying}
          loadingLabel={t('organization.directory.loading')}
          onRetry={directory.retry}
          skeleton={<OrganizationDirectoryTableSkeleton />}
        >
          {(rows) => {
            const isNoteShown = directory.isViewerUnverified && rows.length > 0;

            return (
              <>
                <p aria-live="polite" className="text-sm leading-5 text-on-panel-muted tabular-nums">
                  {t('organization.directory.count', { count: rows.length })}
                </p>
                <OrganizationDirectoryTable
                  emptyState={<OrganizationDirectoryEmpty filter={filter} onReset={handleReset} />}
                  isBusy={directory.isPlaceholderData}
                  labelledBy={titleId}
                  rows={rows}
                  selectedOrganizationId={selectedOrganizationId}
                />
                {isNoteShown && <OrganizationDirectoryUnverifiedNote />}
              </>
            );
          }}
        </WidgetStates>
      </div>
    </section>
  );
};
