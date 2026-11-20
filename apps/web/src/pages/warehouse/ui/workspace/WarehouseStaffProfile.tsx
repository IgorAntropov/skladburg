import type {
  WarehouseStaffProfile,
  WarehouseStaffTask,
} from '@skladburg/contracts/wms/v1/warehouse_staff_profile';
import type { ReactElement } from 'react';

import { timestampMs } from '@bufbuild/protobuf/wkt';
import {
  WarehouseStaffQualificationStatus,
  WarehouseStaffShiftState,
  WarehouseStaffTaskKind,
} from '@skladburg/contracts/wms/v1/warehouse_staff_profile';
import { UserRound } from 'lucide-react';

import { isReadAccessDenied } from '@/shared/api';
import { useI18n } from '@/shared/i18n';
import {
  EmptyState,
  Skeleton,
  WidgetStates,
} from '@/shared/ui';

import type { WarehouseStaffTranslate } from '../../i18n/warehouseStaffSection';

import { useWarehouseStaffProfile } from '../../api/useWarehouseStaffProfiles';
import { warehouseQualificationMessages } from '../../i18n/warehouseQualificationRu';
import { getWarehouseQualificationNameKey } from '../../model/warehouseQualification';

interface WarehouseStaffProfileProps {
  staffId: string;
  t: WarehouseStaffTranslate;
  warehouseId: string;
}

const SHIFT_TEXT = {
  [WarehouseStaffShiftState.OFF_SITE]: 'warehouseStaff.offSite',
  [WarehouseStaffShiftState.ON_BREAK]: 'warehouseStaff.onBreak',
  [WarehouseStaffShiftState.ON_SHIFT]: 'warehouseStaff.onShift',
  [WarehouseStaffShiftState.UNSPECIFIED]: 'warehouseStaff.noData',
} as const;

const QUALIFICATION_TEXT = {
  [WarehouseStaffQualificationStatus.EXPIRED]: 'warehouseStaff.expired',
  [WarehouseStaffQualificationStatus.EXPIRING]: 'warehouseStaff.expiring',
  [WarehouseStaffQualificationStatus.UNSPECIFIED]: 'warehouseStaff.noData',
  [WarehouseStaffQualificationStatus.VALID]: 'warehouseStaff.valid',
} as const;

const TaskList = ({ t, tasks, timeZone }: {
  t: WarehouseStaffTranslate;
  tasks: readonly WarehouseStaffTask[];
  timeZone: string;
}): ReactElement => {
  const { formatDateTime } = useI18n();
  return (
    <ul className="divide-y divide-line text-sm">
      {tasks.map(task => (
        <li className="flex flex-wrap justify-between gap-x-2 py-1" key={`${String(task.kind)}-${task.taskId}`}>
          <span className="wrap-anywhere">
            {t(task.kind === WarehouseStaffTaskKind.PICKING ? 'warehouseStaff.picking' : 'warehouseStaff.receiving')}
            {' '}
            <span translate="no">{task.reference || task.taskId}</span>
          </span>
          {task.completedAt !== undefined && (
            <span className="text-on-panel-muted">{formatDateTime(timestampMs(task.completedAt), { timeZone })}</span>
          )}
        </li>
      ))}
    </ul>
  );
};

const StaffDetails = ({ profile, t }: { profile: WarehouseStaffProfile; t: WarehouseStaffTranslate }): ReactElement => {
  const { createSectionTranslator, formatCalendarDate, formatNumber } = useI18n();
  const qualificationText = createSectionTranslator(warehouseQualificationMessages);
  const { performance, qualifications, timeZone, work } = profile;
  const shiftKey = work?.shiftState === undefined ? undefined : SHIFT_TEXT[work.shiftState];
  const metrics = performance === undefined
    ? []
    : [
        [t('warehouseStaff.completedShift'), performance.completedThisShift === undefined
          ? t('warehouseStaff.noData')
          : formatNumber(performance.completedThisShift)],
        [t('warehouseStaff.completedWeek'), formatNumber(performance.completedThisWeek)],
        [t('warehouseStaff.rate'), t('warehouseStaff.noData')],
        [t('warehouseStaff.quality'), t('warehouseStaff.noData')],
      ];
  return (
    <div className="flex flex-col gap-4 pb-3 text-sm" data-testid="warehouse-staff-profile">
      {shiftKey !== undefined && <p className="font-medium">{t(shiftKey)}</p>}
      {work !== undefined && (
        <section data-testid="warehouse-staff-active">
          <h4 className="font-semibold">{t('warehouseStaff.active')}</h4>
          {work.activeTasks.length === 0
            ? <p className="text-on-panel-muted">{t('warehouseStaff.emptyTasks')}</p>
            : <TaskList t={t} tasks={work.activeTasks} timeZone={timeZone} />}
        </section>
      )}
      {qualifications !== undefined && (
        <section data-testid="warehouse-staff-qualifications">
          <h4 className="font-semibold">{t('warehouseStaff.qualifications')}</h4>
          {qualifications.entries.length === 0 && <p className="text-on-panel-muted">{t('warehouseStaff.noQualifications')}</p>}
          <ul className="divide-y divide-line">
            {qualifications.entries.map((entry) => {
              const label = getWarehouseQualificationNameKey(entry.kind);
              const isWarning = entry.status === WarehouseStaffQualificationStatus.EXPIRING;
              const isExpired = entry.status === WarehouseStaffQualificationStatus.EXPIRED;
              const tone = isExpired ? 'bg-status-alarm text-on-status-alarm' : isWarning ? 'bg-status-warning text-on-status-warning' : '';
              return (
                <li className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 py-2" key={entry.kind}>
                  <span>{label === undefined ? t('warehouseStaff.noData') : qualificationText(label)}</span>
                  {entry.expiresOn !== undefined && (
                    <span>{t('warehouseStaff.expires', { date: formatCalendarDate(entry.expiresOn) })}</span>
                  )}
                  <span className={`rounded-control px-1 ${tone}`}>{t(QUALIFICATION_TEXT[entry.status])}</span>
                </li>
              );
            })}
          </ul>
        </section>
      )}
      {performance !== undefined && (
        <>
          <section data-testid="warehouse-staff-performance">
            <h4 className="font-semibold">{t('warehouseStaff.performance')}</h4>
            <dl className="divide-y divide-line tabular-nums">
              {metrics.map(([label, value]) => (
                <div className="flex flex-wrap justify-between gap-x-3 py-1" key={label}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          </section>
          <section data-testid="warehouse-staff-history">
            <h4 className="font-semibold">{t('warehouseStaff.history')}</h4>
            {performance.history.length === 0
              ? <p className="text-on-panel-muted">{t('warehouseStaff.emptyHistory')}</p>
              : <TaskList t={t} tasks={performance.history} timeZone={timeZone} />}
          </section>
        </>
      )}
    </div>
  );
};

export const WarehouseStaffProfileDetails = ({ staffId, t, warehouseId }: WarehouseStaffProfileProps): ReactElement => {
  const query = useWarehouseStaffProfile(warehouseId, staffId);
  const { t: baseText } = useI18n();
  const unavailable = <EmptyState icon={UserRound} text={t('warehouseStaff.unavailable')} />;

  if (isReadAccessDenied(query.error)) {
    return unavailable;
  }
  return (
    <WidgetStates
      data={query.data}
      error={query.error}
      isRetrying={query.isFetching}
      loadingLabel={baseText('routing.section.loading')}
      onRetry={() => { void query.refetch(); }}
      skeleton={<Skeleton className="h-28 w-full" />}
    >
      {({ profile }) => profile === undefined ? unavailable : <StaffDetails profile={profile} t={t} />}
    </WidgetStates>
  );
};
