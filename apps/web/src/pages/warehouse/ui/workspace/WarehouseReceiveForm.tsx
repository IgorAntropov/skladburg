import type { ReceivingTask } from '@skladburg/contracts/wms/v1/receiving';
import type { ReactElement } from 'react';

import {
  useEffect,
  useRef,
} from 'react';

import { useCommandAccess } from '@/entities/session';
import { useNavigationGuard } from '@/shared/routing';
import {
  ActionButton,
  Button,
  CommandErrorNotice,
  LeaveConfirm,
  TextField,
} from '@/shared/ui';

import type { ReceiveUnitSelectionValue } from '../../api/useReceiveUnitForm';
import type { WarehouseWorkTranslate } from '../../i18n/workspaceSection';

import { useReceiveUnitForm } from '../../api/useReceiveUnitForm';

interface WarehouseReceiveFormProps {
  hasEvidence: boolean;
  hasMarking: boolean;
  onCancel: () => void;
  onReceived: () => void;
  selection: ReceiveUnitSelectionValue;
  t: WarehouseWorkTranslate;
  task: ReceivingTask;
}

export const WarehouseReceiveForm = ({
  hasEvidence, hasMarking, onCancel, onReceived, selection, t, task,
}: WarehouseReceiveFormProps): ReactElement => {
  const translateViolation = (ruleId: string): string | undefined => {
    switch (ruleId) {
      case 'catalog.amount_above_limit':
        return t('warehouseWork.error.quantityLimit');
      case 'scan_duplicate_code':
        return t('warehouseWork.error.duplicate');
      case 'scan_unexpected_item':
      case 'scan_unknown_code':
        return t('warehouseWork.error.invalidCode');
      case 'stock.sscc_checksum':
        return t('warehouseWork.error.invalidSscc');
      default:
        return undefined;
    }
  };
  const form = useReceiveUnitForm(task, selection, onReceived, { hasEvidence, hasMarking, translateViolation });
  const access = useCommandAccess(form.command.method, { kind: 'warehouse', warehouseId: task.warehouseId });
  const { cancelLeave, confirmLeave, isLeavePending, requestLeave } = useNavigationGuard(form.isDirty);
  const formRef = useRef<HTMLFormElement>(null);
  const isLabelled = selection.kind === 'labelled';
  const isPending = form.command.isPending;
  const handleCancel = (): void => {
    console.log('> WarehouseReceiveForm -> handleCancel:', {});
    requestLeave(onCancel);
  };

  useEffect(() => {
    formRef.current?.querySelector('input')?.focus();
  }, []);

  return (
    <form
      className="flex flex-col gap-3 rounded-control border border-line bg-panel-solid p-3"
      data-testid="warehouse-receive-form"
      noValidate
      onSubmit={form.handleSubmit}
      ref={formRef}
    >
      {isLabelled
        ? (
            <TextField
              {...form.getFieldProps('sscc')}
              autoComplete="off"
              inputMode="numeric"
              label={t('warehouseWork.sscc')}
              spellCheck={false}
            />
          )
        : (
            <>
              <TextField {...form.getFieldProps('gtin')} autoComplete="off" inputMode="numeric" label={t('warehouseWork.gtin')} />
              <TextField
                {...form.getFieldProps('quantityBase')}
                autoComplete="off"
                inputMode="numeric"
                label={t('warehouseWork.quantity')}
              />
            </>
          )}
      {hasEvidence && (
        <>
          {isLabelled && (
            <TextField
              {...form.getFieldProps('actualQuantityBase')}
              autoComplete="off"
              inputMode="numeric"
              label={t('warehouseWork.measuredQuantity')}
            />
          )}
          <TextField
            {...form.getFieldProps('defectiveQuantityBase')}
            autoComplete="off"
            inputMode="numeric"
            label={t('warehouseWork.defective')}
          />
        </>
      )}
      {hasMarking && (
        <>
          <TextField
            {...form.getFieldProps('markingCodes')}
            autoComplete="off"
            hint={t('warehouseWork.markingHint')}
            label={t('warehouseWork.markingCodes')}
            spellCheck={false}
          />
          <TextField
            {...form.getFieldProps('defectiveMarkingCodes')}
            autoComplete="off"
            label={t('warehouseWork.defectiveCodes')}
            spellCheck={false}
          />
        </>
      )}
      <div className="flex flex-wrap gap-2">
        <ActionButton
          access={access}
          command={form.command}
          data-testid="warehouse-receive-submit"
          errorPlacement="external"
          type="submit"
        >
          {t('warehouseWork.accept')}
        </ActionButton>
        <Button disabled={isPending} onClick={handleCancel} variant="secondary">{t('warehouseWork.cancel')}</Button>
      </div>
      <CommandErrorNotice command={form.command} />
      {isLeavePending && (
        <LeaveConfirm
          data-testid="warehouse-receive-leave"
          leaveLabel={t('warehouseWork.leave')}
          message={t('warehouseWork.leaveQuestion')}
          onLeave={confirmLeave}
          onStay={cancelLeave}
          stayLabel={t('warehouseWork.stay')}
        />
      )}
    </form>
  );
};
