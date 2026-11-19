import type { WarehouseTopology } from '@skladburg/contracts/wms/v1/topology';
import type { UseQueryResult } from '@tanstack/react-query';
import type {
  ReactElement,
  SyntheticEvent,
} from 'react';

import { ErrorCode } from '@skladburg/contracts/common/v1/error';
import {
  useEffect,
  useState,
} from 'react';

import { useCommandAccess } from '@/entities/session';
import { useNavigationGuard } from '@/shared/routing';
import {
  ActionButton,
  Button,
  LeaveConfirm,
  TextField,
} from '@/shared/ui';

import type { WarehouseWorkTranslate } from '../../i18n/workspaceSection';

import {
  INITIAL_WAREHOUSE_LAYOUT,
  useInitializeWarehouseLayoutForm,
} from '../../api/useInitializeWarehouseLayoutForm';
import { canInitializeWarehouseLayout } from '../../model/canInitializeWarehouseLayout';

export interface WarehouseLayoutInitializeFormProps {
  onEditingChange: (isEditing: boolean) => void;
  onInitialized: () => void;
  query: UseQueryResult<null | WarehouseTopology>;
  t: WarehouseWorkTranslate;
  warehouseId: string;
}

const GROUPS = [
  {
    fields: [
      { label: 'warehouseWork.initializeWidth', name: 'warehouseWidthMm', testId: 'warehouse-layout-warehouse-width' },
      { label: 'warehouseWork.initializeDepth', name: 'warehouseDepthMm', testId: 'warehouse-layout-warehouse-depth' },
    ],
    label: 'warehouseWork.initializeWarehouse',
  },
  {
    fields: [
      { label: 'warehouseWork.initializeWidth', name: 'zoneBounds.widthMm', testId: 'warehouse-layout-zone-width' },
      { label: 'warehouseWork.initializeDepth', name: 'zoneBounds.depthMm', testId: 'warehouse-layout-zone-depth' },
      { label: 'warehouseWork.initializeOffsetX', name: 'zoneBounds.origin.xMm', testId: 'warehouse-layout-zone-x' },
      { label: 'warehouseWork.initializeOffsetZ', name: 'zoneBounds.origin.zMm', testId: 'warehouse-layout-zone-z' },
    ],
    label: 'warehouseWork.initializeZone',
  },
] as const;

export const WarehouseLayoutInitializeForm = ({
  onEditingChange, onInitialized, query, t, warehouseId,
}: WarehouseLayoutInitializeFormProps): ReactElement => {
  const [expectedRevision, setExpectedRevision] = useState(() => query.data?.revision ?? 0);
  const form = useInitializeWarehouseLayoutForm(warehouseId, expectedRevision, onInitialized, t);
  const access = useCommandAccess(form.command.method, { kind: 'warehouse', warehouseId });
  const isPending = form.command.isPending;
  const isEditing = form.isDirty || isPending || form.command.apiError?.isRetryable === true;
  const { cancelLeave, confirmLeave, isLeavePending, requestLeave } = useNavigationGuard(
    isEditing, undefined, { isContextChangeGuarded: true },
  );
  const isVersionConflict = expectedRevision !== (query.data?.revision ?? 0) || form.command.apiError?.code === ErrorCode.VERSION_CONFLICT;
  const isSubmitBlocked = isPending || isLeavePending || isVersionConflict;

  const handleSubmit = (event: SyntheticEvent<HTMLFormElement>): void => {
    if (isSubmitBlocked || access.status !== 'allowed') {
      event.preventDefault();

      return;
    }
    form.handleSubmit(event);
  };

  const handleDiscard = (): void => {
    const { warehouseDepthMm, warehouseWidthMm, zoneBounds } = INITIAL_WAREHOUSE_LAYOUT;
    form.command.reset();
    form.setFieldValue('warehouseWidthMm', warehouseWidthMm);
    form.setFieldValue('warehouseDepthMm', warehouseDepthMm);
    form.setFieldValue('zoneBounds.widthMm', zoneBounds.widthMm);
    form.setFieldValue('zoneBounds.depthMm', zoneBounds.depthMm);
    form.setFieldValue('zoneBounds.origin.xMm', zoneBounds.origin.xMm);
    form.setFieldValue('zoneBounds.origin.zMm', zoneBounds.origin.zMm);
  };

  const handleCancel = (): void => {
    requestLeave(handleDiscard);
  };

  const handleRefresh = (): void => {
    void query.refetch().then(({ data, isError }) => {
      if (!isError) {
        if (canInitializeWarehouseLayout(data)) {
          form.command.reset();
          setExpectedRevision(data?.revision ?? 0);
        }
        else {
          requestLeave(handleDiscard);
        }
      }
    });
  };

  useEffect(() => {
    onEditingChange(isEditing);

    return (): void => {
      onEditingChange(false);
    };
  }, [isEditing, onEditingChange]);

  return (
    <form className="flex flex-col items-start gap-3" data-testid="warehouse-layout-initialize" noValidate onSubmit={handleSubmit}>
      <div>
        <h3 className="text-base font-semibold">{t('warehouseWork.initializeTitle')}</h3>
        <p className="text-sm text-on-panel-muted">{t('warehouseWork.initializeHint')}</p>
      </div>
      <div className="grid w-full gap-4 @xl:grid-cols-2">
        {GROUPS.map(group => (
          <fieldset className="min-w-0" key={group.label}>
            <legend className="mb-2 text-sm font-semibold">{t(group.label)}</legend>
            <div className="grid grid-cols-2 gap-2">
              {group.fields.map(({ label, name, testId }) => (
                <div className="min-w-0" data-testid={testId} key={name}>
                  <TextField
                    {...form.getFieldProps(name)}
                    autoComplete="off"
                    inputMode="numeric"
                    label={t(label)}
                    messageLines={2}
                  />
                </div>
              ))}
            </div>
          </fieldset>
        ))}
      </div>
      {isVersionConflict && (
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm" role="status">{t('warehouseWork.initializeChanged')}</p>
          <Button disabled={query.isFetching || isLeavePending} onClick={handleRefresh} variant="secondary">
            {t('warehouseWork.rackRefresh')}
          </Button>
        </div>
      )}
      <div className="flex flex-wrap items-start gap-2">
        <ActionButton
          access={access}
          command={form.command}
          data-testid="warehouse-layout-initialize-submit"
          isDisabled={isSubmitBlocked}
          type="submit"
        >
          {t('warehouseWork.initializeSubmit')}
        </ActionButton>
        {isEditing && !isPending && (
          <Button data-testid="warehouse-layout-initialize-cancel" onClick={handleCancel} variant="secondary">
            {t('warehouseWork.cancel')}
          </Button>
        )}
      </div>
      {isLeavePending && (
        <LeaveConfirm
          data-testid="warehouse-layout-initialize-leave"
          leaveLabel={t('warehouseWork.leave')}
          message={t('warehouseWork.initializeLeave')}
          onLeave={confirmLeave}
          onStay={cancelLeave}
          stayLabel={t('warehouseWork.stay')}
        />
      )}
    </form>
  );
};
