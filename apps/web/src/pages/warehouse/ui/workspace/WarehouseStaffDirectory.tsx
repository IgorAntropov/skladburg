import type { WarehouseStaffSummary } from '@skladburg/contracts/wms/v1/warehouse_staff_profile';
import type { ReactElement } from 'react';

import {
  ChevronDown,
  Users,
} from 'lucide-react';
import {
  useId,
  useState,
} from 'react';

import {
  isReadAccessDenied,
  useActingContext,
} from '@/shared/api';
import {
  useCatalogSection,
  useI18n,
} from '@/shared/i18n';
import {
  Button,
  EmptyState,
  ErrorNotice,
  Skeleton,
  WidgetStates,
} from '@/shared/ui';

import type { WarehouseStaffTranslate } from '../../i18n/warehouseStaffSection';

import { useWarehouseStaffList } from '../../api/useWarehouseStaffProfiles';
import { warehouseStaffSection } from '../../i18n/warehouseStaffSection';
import { WarehouseStaffIdentity } from './WarehouseStaffIdentity';
import { WarehouseStaffProfileDetails } from './WarehouseStaffProfile';

interface StaffRowProps {
  isExpanded: boolean;
  onToggle: () => void;
  showWarehouse: boolean;
  staff: WarehouseStaffSummary;
  t: WarehouseStaffTranslate;
}

const StaffRow = ({ isExpanded, onToggle, showWarehouse, staff, t }: StaffRowProps): ReactElement => {
  const detailId = useId();
  return (
    <li className="py-1">
      <Button
        aria-controls={isExpanded ? detailId : undefined}
        aria-expanded={isExpanded}
        className="h-auto min-h-11 w-full justify-start gap-3 py-2 text-left"
        data-testid={`warehouse-staff-open-${staff.staffId}`}
        onClick={onToggle}
        variant="ghost"
      >
        <WarehouseStaffIdentity showWarehouse={showWarehouse} staff={staff} t={t} />
        <ChevronDown aria-hidden className={isExpanded ? 'size-4 shrink-0 rotate-180' : 'size-4 shrink-0'} />
      </Button>
      {isExpanded && (
        <div className="px-2 pt-2" id={detailId}>
          <WarehouseStaffProfileDetails staffId={staff.staffId} t={t} warehouseId={staff.warehouseId} />
        </div>
      )}
    </li>
  );
};

const StaffList = ({ t, warehouseId }: { t: WarehouseStaffTranslate; warehouseId: string | undefined }): ReactElement => {
  const { t: baseText } = useI18n();
  const query = useWarehouseStaffList(warehouseId);
  const [expanded, setExpanded] = useState<string>();
  const isEmpty = (staff: readonly WarehouseStaffSummary[]): boolean => staff.length === 0;
  if (isReadAccessDenied(query.error)) {
    return <EmptyState icon={Users} text={t('warehouseStaff.unavailable')} />;
  }
  return (
    <section data-testid="warehouse-staff-directory">
      <h3 className="font-semibold">{t('warehouseStaff.title')}</h3>
      <WidgetStates
        data={query.data}
        empty={<EmptyState icon={Users} text={t('warehouseStaff.empty')} />}
        error={query.error}
        isEmpty={isEmpty}
        isRetrying={query.isFetching}
        loadingLabel={baseText('routing.section.loading')}
        onRetry={() => { void query.refetch(); }}
        skeleton={<Skeleton className="h-16 w-full" />}
      >
        {staff => (
          <ul className="divide-y divide-line">
            {staff.map((member) => {
              const id = `${member.warehouseId}:${member.staffId}`;
              const handleToggle = (): void => {
                setExpanded(current => current === id ? undefined : id);
              };
              return (
                <StaffRow
                  isExpanded={id === expanded}
                  key={id}
                  onToggle={handleToggle}
                  showWarehouse={warehouseId === undefined}
                  staff={member}
                  t={t}
                />
              );
            })}
          </ul>
        )}
      </WidgetStates>
    </section>
  );
};

export const WarehouseStaffDirectory = ({ warehouseId }: { warehouseId: string | undefined }): ReactElement => {
  const { organizationId, userId } = useActingContext();
  const { retry, status, t } = useCatalogSection(warehouseStaffSection);
  if (t === undefined) {
    return status === 'error' ? <ErrorNotice error={null} onRetry={retry} /> : <Skeleton className="h-16 w-full" />;
  }
  return <StaffList key={`${organizationId ?? ''}:${userId ?? ''}:${warehouseId ?? ''}`} t={t} warehouseId={warehouseId} />;
};
