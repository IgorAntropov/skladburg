import type { ReceivingTask } from '@skladburg/contracts/wms/v1/receiving';
import type {
  GetWarehouseEquipmentResponse,
  WarehouseEquipmentUnit,
} from '@skladburg/contracts/wms/v1/warehouse_equipment';
import type {
  MouseEvent,
  ReactElement,
  ReactNode,
} from 'react';

import {
  WarehouseEquipmentKind,
  WarehouseEquipmentStatus,
  WarehouseEquipmentTaskKind,
} from '@skladburg/contracts/wms/v1/warehouse_equipment';
import {
  Battery,
  BatteryCharging,
  ChevronRight,
  Forklift,
  PlugZap,
} from 'lucide-react';

import { isReadAccessDenied } from '@/shared/api';
import { useI18n } from '@/shared/i18n';
import {
  Button,
  EmptyState,
  Skeleton,
  WidgetStates,
} from '@/shared/ui';

import type { WarehouseWorkTranslate } from '../../i18n/workspaceSection';

import { useWarehouseEquipment } from '../../api/useWarehouseEquipment';
import { useWarehouseStaffList } from '../../api/useWarehouseStaffProfiles';
import {
  warehouseEquipmentLabels,
  warehouseEquipmentStatusKey,
} from '../../i18n/warehouseEquipmentLabels';

interface WarehouseEquipmentDetailsProps extends WarehouseEquipmentProps {
  equipmentId: string;
  receivingTasks: readonly ReceivingTask[] | undefined;
}

interface WarehouseEquipmentListProps extends WarehouseEquipmentProps {
  onSelect: (id: string, trigger: HTMLElement) => void;
}

interface WarehouseEquipmentProps {
  t: WarehouseWorkTranslate;
  warehouseId: string;
}

const KIND_TEXT = {
  [WarehouseEquipmentKind.FORKLIFT]: 'warehouseWork.equipmentForklift',
  [WarehouseEquipmentKind.PALLET_TRUCK]: 'warehouseWork.equipmentPalletTruck',
  [WarehouseEquipmentKind.STACKER]: 'warehouseWork.equipmentStacker',
  [WarehouseEquipmentKind.UNSPECIFIED]: 'warehouseWork.equipmentKindUnknown',
} as const;

const EquipmentQuery = ({ children, t, warehouseId }: WarehouseEquipmentProps & {
  children: (data: GetWarehouseEquipmentResponse) => ReactNode;
}): ReactElement => {
  const { t: baseText } = useI18n();
  const query = useWarehouseEquipment(warehouseId);

  if (isReadAccessDenied(query.error)) {
    return <EmptyState icon={Forklift} text={t('warehouseWork.noAccess')} />;
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
      {children}
    </WidgetStates>
  );
};

const EquipmentBattery = ({ testId, unit }: { testId: string; unit: WarehouseEquipmentUnit }): ReactElement => {
  const { formatNumber } = useI18n();
  const Icon = unit.status === WarehouseEquipmentStatus.CHARGING ? BatteryCharging : Battery;
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap tabular-nums" data-percent={unit.batteryPercent} data-testid={testId}>
      <Icon aria-hidden className="size-4 shrink-0" />
      {formatNumber(unit.batteryPercent / 100, { style: 'percent' })}
    </span>
  );
};

export const WarehouseEquipmentList = ({ onSelect, t, warehouseId }: WarehouseEquipmentListProps): ReactElement => {
  const { createSectionTranslator } = useI18n();
  const label = createSectionTranslator(warehouseEquipmentLabels);
  return (
    <EquipmentQuery t={t} warehouseId={warehouseId}>
      {({ equipment, stations }) => {
        if (equipment.length === 0 && stations.length === 0) {
          return <EmptyState data-testid="warehouse-equipment-empty" icon={Forklift} text={t('warehouseWork.equipmentEmpty')} />;
        }
        return (
          <div className="flex flex-col gap-5" data-testid="warehouse-equipment-list">
            {equipment.length > 0 && (
              <section>
                <h3 className="border-b border-line pb-2 font-semibold">{t('warehouseWork.equipmentFleet')}</h3>
                <ul className="divide-y divide-line">
                  {equipment.map((unit) => {
                    const handleSelect = (event: MouseEvent<HTMLButtonElement>): void => {
                      onSelect(unit.id, event.currentTarget);
                    };
                    return (
                      <li key={unit.id}>
                        <Button
                          aria-haspopup="dialog"
                          className="w-full px-2 text-left"
                          data-testid={`warehouse-equipment-open-${unit.id}`}
                          onClick={handleSelect}
                          variant="neutral"
                        >
                          <span className="min-w-0 flex-1 text-start">
                            <span className="block font-semibold wrap-anywhere" translate="no">{unit.code}</span>
                            <span
                              className="block text-sm font-normal text-on-panel-muted"
                              data-status={unit.status}
                              data-testid={`warehouse-equipment-status-${unit.id}`}
                            >
                              {label(warehouseEquipmentStatusKey(unit.status))}
                            </span>
                          </span>
                          <span className="flex shrink-0 items-center gap-2">
                            <span className="sr-only">{t('warehouseWork.equipmentBattery')}</span>
                            <EquipmentBattery testId={`warehouse-equipment-battery-${unit.id}`} unit={unit} />
                            <ChevronRight aria-hidden className="size-4 shrink-0 text-on-panel-muted" />
                          </span>
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}
            {stations.length > 0 && (
              <section>
                <h3 className="border-b border-line pb-2 font-semibold">{t('warehouseWork.equipmentStations')}</h3>
                <ul className="divide-y divide-line">
                  {stations.map((station) => {
                    const occupant = equipment.find(unit => unit.id === station.equipmentId);
                    const statusKey = station.equipmentId === undefined
                      ? 'warehouseEquipment.stationFree'
                      : 'warehouseEquipment.stationBusy';
                    const status = label(statusKey);
                    return (
                      <li
                        className="flex min-h-11 flex-wrap items-center justify-between gap-x-2 px-2 py-2"
                        data-equipment-id={station.equipmentId}
                        data-testid={`warehouse-equipment-station-${station.id}`}
                        key={station.id}
                      >
                        <span className="flex items-center gap-2">
                          <PlugZap aria-hidden className="size-4" />
                          <span className="font-medium" translate="no">{station.code}</span>
                        </span>
                        <span className="text-sm text-on-panel-muted">
                          {occupant === undefined ? status : label('warehouseEquipment.stationLabel', { code: occupant.code, status })}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}
          </div>
        );
      }}
    </EquipmentQuery>
  );
};

const EquipmentDetails = ({
  data, receivingTasks, t, unit, warehouseId,
}: Omit<WarehouseEquipmentDetailsProps, 'equipmentId'> & {
  data: GetWarehouseEquipmentResponse;
  unit: WarehouseEquipmentUnit;
}): ReactElement => {
  const { createSectionTranslator, formatNumber, t: baseText } = useI18n();
  const staff = useWarehouseStaffList(warehouseId, unit.driverStaffId !== undefined);
  const hasDriver = unit.driverStaffId !== undefined && !isReadAccessDenied(staff.error);
  const driver = staff.data?.find(person => person.staffId === unit.driverStaffId);
  const station = data.stations.find(entry => entry.id === unit.chargingStationId);
  const label = createSectionTranslator(warehouseEquipmentLabels);
  const taskReference = unit.taskKind === WarehouseEquipmentTaskKind.RECEIVING
    ? receivingTasks?.find(task => task.id === unit.taskId)?.sourceDocumentNumber
    : undefined;
  const taskKind = unit.taskKind === WarehouseEquipmentTaskKind.RECEIVING
    ? t('warehouseWork.receipt')
    : unit.taskKind === WarehouseEquipmentTaskKind.PICKING ? t('warehouseWork.picking') : undefined;

  return (
    <>
      <h3 className="mb-3 text-xl font-semibold wrap-anywhere" translate="no">{unit.code}</h3>
      <dl className="grid grid-cols-2 items-baseline gap-x-3 gap-y-2 text-sm wrap-anywhere [&>dd]:font-medium [&>dt]:text-on-panel-muted">
        <dt>{t('warehouseWork.equipmentStatus')}</dt>
        <dd data-status={unit.status} data-testid="warehouse-equipment-inspector-status">
          {label(warehouseEquipmentStatusKey(unit.status))}
        </dd>
        <dt>{t('warehouseWork.equipmentBattery')}</dt>
        <dd><EquipmentBattery testId="warehouse-equipment-inspector-battery" unit={unit} /></dd>
        {station !== undefined && (
          <>
            <dt>{t('warehouseWork.equipmentStation')}</dt>
            <dd data-station-id={station.id} data-testid="warehouse-equipment-inspector-station" translate="no">{station.code}</dd>
          </>
        )}
        {hasDriver && (
          <>
            <dt>{t('warehouseWork.equipmentDriver')}</dt>
            <dd data-staff-id={unit.driverStaffId} data-testid="warehouse-equipment-driver" translate="no">
              {staff.isPending
                ? (
                    <>
                      <span className="sr-only">{baseText('routing.section.loading')}</span>
                      <Skeleton className="h-4 w-24" />
                    </>
                  )
                : driver?.displayName ?? unit.driverStaffId}
            </dd>
          </>
        )}
        {unit.taskId !== undefined && (
          <>
            <dt>{t('warehouseWork.equipmentTask')}</dt>
            <dd data-task-id={unit.taskId} data-testid="warehouse-equipment-task">
              {taskKind}
              {' '}
              <bdi>{taskReference === undefined || taskReference === '' ? unit.taskId : taskReference}</bdi>
            </dd>
          </>
        )}
        <dt>{t('warehouseWork.equipmentKind')}</dt>
        <dd>{t(KIND_TEXT[unit.kind])}</dd>
        <dt>{t('warehouseWork.equipmentModel')}</dt>
        <dd translate="no">{unit.model}</dd>
        <dt>{t('warehouseWork.equipmentCapacity')}</dt>
        <dd>{formatNumber(unit.capacityKg, { style: 'unit', unit: 'kilogram' })}</dd>
        <dt>{t('warehouseWork.equipmentHeight')}</dt>
        <dd>{formatNumber(unit.liftHeightMm / 1000, { style: 'unit', unit: 'meter' })}</dd>
      </dl>
    </>
  );
};

export const WarehouseEquipmentDetails = ({
  equipmentId, receivingTasks, t, warehouseId,
}: WarehouseEquipmentDetailsProps): ReactElement => (
  <EquipmentQuery t={t} warehouseId={warehouseId}>
    {(data) => {
      const unit = data.equipment.find(entry => entry.id === equipmentId);
      return unit === undefined
        ? <EmptyState icon={Forklift} text={t('warehouseWork.equipmentUnavailable')} />
        : <EquipmentDetails data={data} receivingTasks={receivingTasks} t={t} unit={unit} warehouseId={warehouseId} />;
    }}
  </EquipmentQuery>
);
