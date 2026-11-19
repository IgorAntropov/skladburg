import type { WarehouseCapability } from '@skladburg/contracts/organization/v1/organization';
import type {
  WarehouseTopology,
  WarehouseUnloadingPoint,
} from '@skladburg/contracts/wms/v1/topology';
import type { UseQueryResult } from '@tanstack/react-query';
import type {
  ReactElement,
  SyntheticEvent,
} from 'react';

import { equals } from '@bufbuild/protobuf';
import {
  ErrorCode,
  WarehouseReceivingLayoutBlockedReason,
} from '@skladburg/contracts/common/v1/error';
import { WarehouseReceivingAreaSchema } from '@skladburg/contracts/wms/v1/topology';
import {
  useEffect,
  useRef,
  useState,
} from 'react';

import type { ApiErrorValue } from '@/shared/api';

import { useCommandAccess } from '@/entities/session';
import { useNavigationGuard } from '@/shared/routing';
import {
  ActionButton,
  Button,
  CommandErrorNotice,
  LeaveConfirm,
  TextField,
} from '@/shared/ui';

import type { WarehouseWorkTranslate } from '../../i18n/workspaceSection';

import {
  RECEIVING_LAYOUT_DOCK_CAPACITY,
  useConfigureWarehouseReceivingLayoutForm,
} from '../../api/useConfigureWarehouseReceivingLayoutForm';
import { createReceivingLayoutDefaults } from '../../model/warehouseReceivingLayout';
import { WarehouseReceivingLayoutDockFields } from './WarehouseReceivingLayoutDockFields';

export interface WarehouseReceivingLayoutFormProps {
  initialTopology: WarehouseTopology;
  onClose: () => void;
  onEditingChange: (isEditing: boolean) => void;
  query: UseQueryResult<null | WarehouseTopology>;
  t: WarehouseWorkTranslate;
  warehouseCapabilities: readonly WarehouseCapability[];
  warehouseId: string;
}

const FOOTPRINT_FIELDS = [
  { label: 'warehouseWork.initializeWidth', name: 'receivingFootprint.widthMm', testId: 'warehouse-receiving-layout-width' },
  { label: 'warehouseWork.initializeDepth', name: 'receivingFootprint.depthMm', testId: 'warehouse-receiving-layout-depth' },
  { label: 'warehouseWork.initializeOffsetX', name: 'receivingFootprint.origin.xMm', testId: 'warehouse-receiving-layout-x' },
  { label: 'warehouseWork.initializeOffsetZ', name: 'receivingFootprint.origin.zMm', testId: 'warehouse-receiving-layout-z' },
] as const;

const readBlockedNotice = (
  error: ApiErrorValue | undefined,
  docks: readonly WarehouseUnloadingPoint[],
  t: WarehouseWorkTranslate,
): string | undefined => {
  if (error?.code !== ErrorCode.WAREHOUSE_RECEIVING_LAYOUT_BLOCKED || error.params.case !== 'warehouseReceivingLayoutBlocked') {
    return undefined;
  }

  const { reason, unloadingPointId } = error.params.value;
  switch (reason) {
    case WarehouseReceivingLayoutBlockedReason.DOCK_OCCUPIED: {
      const dock = docks.find(entry => entry.id === unloadingPointId);

      return dock === undefined
        ? t('warehouseWork.receivingLayoutDockBusy')
        : t('warehouseWork.receivingLayoutNamedDockBusy', { code: dock.code });
    }
    case WarehouseReceivingLayoutBlockedReason.RECEIVING_AREA_OCCUPIED:
      return t('warehouseWork.receivingLayoutAreaBusy');
    case WarehouseReceivingLayoutBlockedReason.YARD_ACTIVE:
      return t('warehouseWork.receivingLayoutYardBusy');
    default:
      return undefined;
  }
};

const hasSameReceivingArea = (current: WarehouseTopology, initial: WarehouseTopology): boolean =>
  current.receivingArea === initial.receivingArea || (current.receivingArea !== undefined && initial.receivingArea !== undefined
    && equals(WarehouseReceivingAreaSchema, current.receivingArea, initial.receivingArea));

export const WarehouseReceivingLayoutForm = ({
  initialTopology, onClose, onEditingChange, query, t, warehouseCapabilities, warehouseId,
}: WarehouseReceivingLayoutFormProps): ReactElement => {
  const [expectedRevision, setExpectedRevision] = useState(() => initialTopology.revision);
  const [defaults] = useState(() => createReceivingLayoutDefaults(initialTopology, warehouseCapabilities, RECEIVING_LAYOUT_DOCK_CAPACITY));
  const form = useConfigureWarehouseReceivingLayoutForm(warehouseId, expectedRevision, defaults, onClose, t);
  const access = useCommandAccess(form.command.method, { kind: 'warehouse', warehouseId });
  const headingRef = useRef<HTMLHeadingElement>(null);
  const isPending = form.command.isPending;
  const isEditing = form.isDirty || isPending || form.command.apiError?.isRetryable === true;
  const { cancelLeave, confirmLeave, isLeavePending, requestLeave } = useNavigationGuard(
    isEditing, undefined, { isContextChangeGuarded: true },
  );
  const currentTopology = query.data;
  const hasReceivingConflict = currentTopology === null
    || (currentTopology !== undefined && !hasSameReceivingArea(currentTopology, initialTopology));
  const isVersionConflict = currentTopology?.revision !== expectedRevision || form.command.apiError?.code === ErrorCode.VERSION_CONFLICT;
  const isSubmitBlocked = isPending || isLeavePending || hasReceivingConflict || isVersionConflict;
  const blockedNotice = isPending ? undefined : readBlockedNotice(form.command.apiError, defaults.docks, t);
  const hasStandaloneError = blockedNotice === undefined && !hasReceivingConflict && !isVersionConflict;

  const handleSubmit = (event: SyntheticEvent<HTMLFormElement>): void => {
    if (isSubmitBlocked || access.status !== 'allowed') {
      event.preventDefault();

      return;
    }
    form.handleSubmit(event);
  };

  const handleCancel = (): void => {
    requestLeave(onClose);
  };

  const handleRefresh = (): void => {
    void query.refetch().then(({ data, isError }) => {
      if (!isError && data !== null && data !== undefined && hasSameReceivingArea(data, initialTopology)) {
        form.command.reset();
        setExpectedRevision(data.revision);
      }
    });
  };

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  useEffect(() => {
    onEditingChange(isEditing);

    return (): void => {
      onEditingChange(false);
    };
  }, [isEditing, onEditingChange]);

  return (
    <form className="flex min-w-0 flex-col gap-4" data-testid="warehouse-receiving-layout-form" noValidate onSubmit={handleSubmit}>
      <div>
        <h3 className="text-base font-semibold" ref={headingRef} tabIndex={-1}>{t('warehouseWork.receivingLayoutEdit')}</h3>
        <p className="text-sm text-on-panel-muted">{t('warehouseWork.receivingLayoutHint')}</p>
      </div>
      <div className="grid gap-4 @2xl:grid-cols-2">
        <fieldset className="min-w-0">
          <legend className="mb-2 text-base font-semibold">{t('warehouseWork.receivingArea')}</legend>
          <div className="grid grid-cols-2 gap-2">
            {FOOTPRINT_FIELDS.map(({ label, name, testId }) => (
              <div className="min-w-0" data-testid={testId} key={name}>
                <TextField {...form.getFieldProps(name)} inputMode="numeric" label={t(label)} messageLines={2} />
              </div>
            ))}
          </div>
        </fieldset>
        <WarehouseReceivingLayoutDockFields defaults={defaults} form={form} t={t} warehouseCapabilities={warehouseCapabilities} />
      </div>
      {hasReceivingConflict && <p role="status">{t('warehouseWork.receivingLayoutChangedRemotely')}</p>}
      {isVersionConflict && !hasReceivingConflict && (
        <div className="flex flex-wrap items-center gap-2">
          <p role="status">{t('warehouseWork.receivingLayoutVersionConflict')}</p>
          <Button disabled={query.isFetching || isLeavePending} onClick={handleRefresh} variant="secondary">
            {t('warehouseWork.rackRefresh')}
          </Button>
        </div>
      )}
      {blockedNotice !== undefined && (
        <p
          className="rounded-control border border-line-strong bg-panel-solid p-3"
          data-testid="warehouse-receiving-layout-blocked"
          role="alert"
        >
          {blockedNotice}
        </p>
      )}
      <div className="flex flex-wrap items-start gap-2">
        <ActionButton
          access={access}
          command={form.command}
          data-testid="warehouse-receiving-layout-submit"
          errorPlacement="external"
          isDisabled={isSubmitBlocked}
          type="submit"
        >
          {t('warehouseWork.receivingLayoutSubmit')}
        </ActionButton>
        <Button disabled={isPending || isLeavePending} onClick={handleCancel} variant="secondary">
          {t('warehouseWork.cancel')}
        </Button>
      </div>
      {hasStandaloneError && <CommandErrorNotice command={form.command} />}
      {isLeavePending && (
        <LeaveConfirm
          data-testid="warehouse-receiving-layout-leave"
          leaveLabel={t('warehouseWork.leave')}
          message={t('warehouseWork.receivingLayoutLeave')}
          onLeave={confirmLeave}
          onStay={cancelLeave}
          stayLabel={t('warehouseWork.stay')}
        />
      )}
    </form>
  );
};
