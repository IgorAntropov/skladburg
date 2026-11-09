import type {
  CarrierLane,
  Driver,
  Vehicle,
} from '@skladburg/contracts/fleet/v1/fleet';
import type { ReactElement } from 'react';

import { useQueryClient } from '@tanstack/react-query';
import {
  Check,
  Minus,
} from 'lucide-react';
import {
  useEffect,
  useRef,
  useState,
} from 'react';

import type { CommandAccessValue } from '@/shared/api';

import { useNetworkDirectoryQuery } from '@/entities/network';
import { useActingContext } from '@/shared/api';
import { useI18n } from '@/shared/i18n';
import {
  createCachedModuleLoader,
  useChunkLoader,
} from '@/shared/lib/module-loader';
import { formatMoney } from '@/shared/lib/money';
import {
  Button,
  ChunkLoadNotice,
  SkeletonGroup,
  Tabs,
  useAnnounce,
  WidgetStates,
} from '@/shared/ui';

import type { FleetListKindValue } from '../api/useFleetList';
import type { GarageTranslate } from '../i18n/garageSection';
import type {
  GarageEditorValue,
  GarageRecordValue,
} from './garageEditorTypes';

import {
  fetchCarrierLanes,
  fetchDrivers,
  fetchVehicles,
} from '../api/fetchFleetPage';
import {
  FLEET_SAVE_METHODS,
  fleetListKey,
} from '../api/useFleetList';
import { GarageList } from './GarageList';
import { GarageRecordRow } from './GarageRecordRow';
import { GarageSkeleton } from './GarageSkeleton';
import { GarageVehicleDetails } from './GarageVehicleDetails';

interface GarageWorkspaceProps {
  t: GarageTranslate;
}

const editorLoader = createCachedModuleLoader(() => import('./GarageEditorSlot'));

const weekdayKeys = {
  1: 'garage.weekday.1',
  2: 'garage.weekday.2',
  3: 'garage.weekday.3',
  4: 'garage.weekday.4',
  5: 'garage.weekday.5',
  6: 'garage.weekday.6',
  7: 'garage.weekday.7',
} as const;

const isWeekday = (value: number): value is keyof typeof weekdayKeys => Object.hasOwn(weekdayKeys, value);

const GarageActive = ({ isActive, t }: { isActive: boolean; t: GarageTranslate }): ReactElement => {
  const Icon = isActive ? Check : Minus;

  return (
    <span className="inline-flex items-center gap-1.5 text-sm text-on-panel-muted">
      <Icon aria-hidden className="size-4" />
      {t(isActive ? 'garage.status.active' : 'garage.status.inactive')}
    </span>
  );
};

export const GarageWorkspace = ({ t }: GarageWorkspaceProps): ReactElement => {
  const { locale } = useI18n();
  const { organizationId, userId } = useActingContext();
  const queryClient = useQueryClient();
  const announce = useAnnounce();
  const directory = useNetworkDirectoryQuery();
  const { load, state } = useChunkLoader(editorLoader);
  const tabRootRef = useRef<HTMLDivElement>(null);
  const shouldReturnFocus = useRef(false);
  const [defaultTabId, setDefaultTabId] = useState<FleetListKindValue>('vehicles');
  const [editor, setEditor] = useState<GarageEditorValue | undefined>(undefined);

  const cities = directory.data?.cities ?? [];
  const LoadedEditor = state.kind === 'loaded' ? state.module.GarageEditorSlot : undefined;

  const handleOpen = (next: GarageEditorValue): void => {
    setDefaultTabId(next.kind);
    setEditor(next);
    load();
  };

  const handleOpenDriver = (record: Driver | undefined): void => {
    handleOpen({ kind: 'drivers', record });
  };

  const handleOpenLane = (record: CarrierLane | undefined): void => {
    handleOpen({ kind: 'lanes', record });
  };

  const handleOpenVehicle = (record: undefined | Vehicle): void => {
    handleOpen({ kind: 'vehicles', record });
  };

  const handleClose = (): void => {
    if (editor !== undefined) {
      void queryClient.invalidateQueries({ queryKey: fleetListKey(organizationId, userId, editor.kind) });
    }

    shouldReturnFocus.current = true;
    setEditor(undefined);
  };

  const handleSaved = (record: GarageRecordValue): void => {
    if (editor !== undefined && record.tenantId === organizationId) {
      const key = fleetListKey(organizationId, userId, editor.kind);
      queryClient.setQueryData<GarageRecordValue[]>(key, (records) => {
        if (records === undefined || records.some(current => current.id === record.id && current.version >= record.version)) {
          return records;
        }

        return [...records.filter(current => current.id !== record.id), record]
          .sort((current, prev) => current.id.localeCompare(prev.id));
      });
    }

    announce(t('garage.actions.saved'));
    handleClose();
  };

  const handleRetryCities = (): void => {
    void directory.refetch();
  };

  const readCityName = (id: string): string => cities.find(city => city.id === id)?.name ?? t('garage.unknown');

  const renderDriver = (driver: Driver, access: CommandAccessValue): ReactElement => {
    const handleEdit = (): void => {
      handleOpenDriver(driver);
    };

    return (
      <GarageRecordRow
        access={access}
        onEdit={handleEdit}
        t={t}
        testId="garage-driver-row"
        title={driver.displayName}
      >
        <GarageActive isActive={driver.isActive} t={t} />
      </GarageRecordRow>
    );
  };

  const renderLane = (lane: CarrierLane, access: CommandAccessValue): ReactElement => {
    const title = t('garage.lane.route', { from: readCityName(lane.fromCityId), to: readCityName(lane.toCityId) });
    const days = lane.departureWeekdays.filter(isWeekday).map(day => t(weekdayKeys[day])).join(', ');

    const handleEdit = (): void => {
      handleOpenLane(lane);
    };

    return (
      <GarageRecordRow access={access} onEdit={handleEdit} t={t} testId="garage-lane-row" title={title}>
        <GarageActive isActive={lane.isActive} t={t} />
        <dl className="flex flex-wrap items-start justify-between gap-2 text-sm">
          <div>
            <dt className="text-on-panel-muted">{t('garage.lane.weekdays')}</dt>
            <dd>{days}</dd>
          </div>
          {lane.tariff !== undefined && (
            <div>
              <dt className="text-on-panel-muted">{t('garage.lane.tariff')}</dt>
              <dd className="font-semibold tabular-nums">{formatMoney(locale, lane.tariff)}</dd>
            </div>
          )}
        </dl>
      </GarageRecordRow>
    );
  };

  const renderVehicle = (vehicle: Vehicle, access: CommandAccessValue): ReactElement => {
    const { details } = vehicle;

    const handleEdit = (): void => {
      handleOpenVehicle(vehicle);
    };

    return (
      <GarageRecordRow
        access={access}
        onEdit={handleEdit}
        t={t}
        testId="garage-vehicle-row"
        title={details?.registrationNumber ?? t('garage.unknown')}
      >
        {details !== undefined && <GarageVehicleDetails cities={cities} details={details} t={t} />}
      </GarageRecordRow>
    );
  };

  useEffect(() => {
    if (editor === undefined && shouldReturnFocus.current) {
      shouldReturnFocus.current = false;
      tabRootRef.current?.querySelector<HTMLButtonElement>('[role="tab"][aria-selected="true"]')?.focus();
    }
  }, [editor]);

  if (editor !== undefined) {
    if (LoadedEditor !== undefined) {
      return <LoadedEditor cities={cities} editor={editor} onClose={handleClose} onSaved={handleSaved} />;
    }

    return (
      <div className="flex flex-col items-start gap-3">
        {state.kind === 'failed'
          ? (
              <ChunkLoadNotice
                message={t('garage.chunk.error')}
                onRetry={load}
                recovery={state.recovery}
                repeatedMessage={t('garage.chunk.repeated')}
              />
            )
          : <SkeletonGroup isFilled label={t('garage.loading')}><GarageSkeleton /></SkeletonGroup>}
        <Button onClick={handleClose} variant="secondary">{t('garage.actions.close')}</Button>
      </div>
    );
  }

  const renderWithCities = (content: ReactElement): ReactElement => (
    <WidgetStates
      data={directory.data}
      error={directory.error}
      isRetrying={directory.isFetching}
      loadingLabel={t('garage.loading')}
      onRetry={handleRetryCities}
      skeleton={<GarageSkeleton />}
    >
      {() => content}
    </WidgetStates>
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col" ref={tabRootRef}>
      <Tabs
        defaultTabId={defaultTabId}
        items={[
          {
            content: renderWithCities(
              <GarageList
                addLabel={t('garage.actions.addVehicle')}
                emptyLabel={t('garage.vehicle.empty')}
                fetchPage={fetchVehicles}
                kind="vehicles"
                method={FLEET_SAVE_METHODS.vehicles}
                onEdit={handleOpenVehicle}
                renderRecord={renderVehicle}
                t={t}
                testId="garage-vehicles"
              />,
            ),
            id: 'vehicles',
            label: t('garage.vehicle.tab'),
          },
          {
            content: (
              <GarageList
                addLabel={t('garage.actions.addDriver')}
                emptyLabel={t('garage.driver.empty')}
                fetchPage={fetchDrivers}
                kind="drivers"
                method={FLEET_SAVE_METHODS.drivers}
                onEdit={handleOpenDriver}
                renderRecord={renderDriver}
                t={t}
                testId="garage-drivers"
              />
            ),
            id: 'drivers',
            label: t('garage.driver.tab'),
          },
          {
            content: renderWithCities(
              <GarageList
                addLabel={t('garage.actions.addLane')}
                emptyLabel={t('garage.lane.empty')}
                fetchPage={fetchCarrierLanes}
                kind="lanes"
                method={FLEET_SAVE_METHODS.lanes}
                onEdit={handleOpenLane}
                renderRecord={renderLane}
                t={t}
                testId="garage-lanes"
              />,
            ),
            id: 'lanes',
            label: t('garage.lane.tab'),
          },
        ]}
        label={t('garage.tabs.label')}
      />
    </div>
  );
};
