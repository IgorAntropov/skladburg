import type { WarehouseStaffAreaPresence } from '@skladburg/contracts/wms/v1/warehouse_staff_presence';
import type { ReactElement } from 'react';

import { WarehouseStaffAreaKind } from '@skladburg/contracts/wms/v1/warehouse_staff_presence';
import { Users } from 'lucide-react';

import { isReadAccessDenied } from '@/shared/api';
import { useI18n } from '@/shared/i18n';
import {
  EmptyState,
  Skeleton,
  WidgetStates,
} from '@/shared/ui';

import type { WarehouseWorkTranslate } from '../../i18n/workspaceSection';

import { useWarehouseStaffPresence } from '../../api/useWarehouseStaffPresence';

interface WarehouseStaffAreasProps {
  areas: readonly WarehouseStaffAreaPresence[];
  t: WarehouseWorkTranslate;
}

interface WarehouseStaffPresenceProps {
  t: WarehouseWorkTranslate;
  warehouseId: string;
}

const areaLabel = (area: WarehouseStaffAreaPresence, t: WarehouseWorkTranslate): string => {
  if (area.kind === WarehouseStaffAreaKind.RECEIVING) {
    return area.areaCode ? t('warehouseWork.staffReceivingCode', { code: area.areaCode }) : t('warehouseWork.receivingArea');
  }
  const label = area.kind === WarehouseStaffAreaKind.STORAGE ? 'warehouseWork.staffStorageCode' : 'warehouseWork.staffAreaCode';
  return t(label, { code: area.areaCode || area.areaId });
};

const WarehouseStaffAreas = ({ areas, t }: WarehouseStaffAreasProps): ReactElement => {
  const { formatNumber } = useI18n();

  return (
    <table className="w-full border-collapse text-right text-sm">
      <caption className="pb-3 text-left">
        <span className="block text-base font-semibold">{t('warehouseWork.staffPresence')}</span>
        <span className="mt-1 block text-on-panel-muted">{t('warehouseWork.staffEvidence')}</span>
      </caption>
      <thead className="border-b border-line text-on-panel-muted">
        <tr>
          <th className="py-2 text-left font-medium" scope="col">{t('warehouseWork.staffArea')}</th>
          <th className="py-2 pl-2 font-medium" scope="col">{t('warehouseWork.staffCount')}</th>
          <th className="py-2 pl-2 font-medium" scope="col">{t('warehouseWork.staffPlan')}</th>
          <th className="py-2 pl-2 font-medium" scope="col">{t('warehouseWork.staffDelta')}</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-line tabular-nums">
        {areas.map((area) => {
          const { areaId, observedStaffCount, plannedStaffCount } = area;
          const delta = plannedStaffCount === undefined ? undefined : observedStaffCount - plannedStaffCount;

          return (
            <tr key={areaId}>
              <th className="py-2 text-left font-medium wrap-anywhere" scope="row">{areaLabel(area, t)}</th>
              <td className="py-2 pl-2" data-testid={`warehouse-staff-count-${areaId}`}>{formatNumber(observedStaffCount)}</td>
              <td className="py-2 pl-2" colSpan={plannedStaffCount === undefined ? 2 : 1} data-testid={`warehouse-staff-plan-${areaId}`}>
                {plannedStaffCount === undefined ? t('warehouseWork.staffNoPlan') : formatNumber(plannedStaffCount)}
              </td>
              {delta !== undefined && (
                <td className="py-2 pl-2 font-semibold" data-testid={`warehouse-staff-delta-${areaId}`}>
                  <span className={delta < 0 ? 'rounded-control bg-status-warning px-1 text-on-status-warning' : undefined}>
                    {formatNumber(delta, { signDisplay: 'exceptZero' })}
                  </span>
                </td>
              )}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
};

export const WarehouseStaffPresence = ({ t, warehouseId }: WarehouseStaffPresenceProps): ReactElement => {
  const { formatNumber, t: baseText } = useI18n();
  const query = useWarehouseStaffPresence(warehouseId);

  if (isReadAccessDenied(query.error)) {
    return <EmptyState icon={Users} text={t('warehouseWork.noAccess')} />;
  }

  return (
    <WidgetStates
      data={query.data}
      error={query.error}
      isRetrying={query.isFetching}
      loadingLabel={baseText('routing.section.loading')}
      onRetry={query.refetch}
      skeleton={<Skeleton className="h-28 w-full" />}
    >
      {({ areas, shift }) => (
        <div className="flex flex-col gap-5" data-testid="warehouse-staff-presence">
          <section>
            <h3 className="text-base font-semibold">{t('warehouseWork.staffShift')}</h3>
            {shift === undefined
              ? <p className="mt-1 text-sm text-on-panel-muted" data-testid="warehouse-staff-no-shift">{t('warehouseWork.staffNoShift')}</p>
              : (
                  <dl className="mt-2 grid grid-cols-3 gap-2 text-sm" data-testid="warehouse-staff-shift">
                    <div className="flex flex-col justify-between">
                      <dt className="text-on-panel-muted">{t('warehouseWork.staffOnShift')}</dt>
                      <dd className="font-semibold tabular-nums" data-testid="warehouse-staff-on-shift">
                        {formatNumber(shift.onShiftCount)}
                      </dd>
                    </div>
                    <div className="flex flex-col justify-between">
                      <dt className="text-on-panel-muted">{t('warehouseWork.staffOnBreak')}</dt>
                      <dd className="font-semibold tabular-nums" data-testid="warehouse-staff-on-break">
                        {formatNumber(shift.onBreakCount)}
                      </dd>
                    </div>
                    <div className="flex flex-col justify-between">
                      <dt className="text-on-panel-muted">{t('warehouseWork.staffOffSite')}</dt>
                      <dd className="font-semibold tabular-nums" data-testid="warehouse-staff-off-site">
                        {formatNumber(shift.offSiteCount)}
                      </dd>
                    </div>
                  </dl>
                )}
          </section>
          {areas.length > 0
            ? <WarehouseStaffAreas areas={areas} t={t} />
            : <EmptyState icon={Users} text={t('warehouseWork.staffEmpty')} />}
        </div>
      )}
    </WidgetStates>
  );
};
