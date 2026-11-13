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
import type { WarehouseScanHandlerValue } from './WarehouseScanner';

import { useReceiveUnitForm } from '../../api/useReceiveUnitForm';
import { WarehouseScanner } from './WarehouseScanner';

interface WarehouseReceiveFormProps {
  hasEvidence: boolean;
  hasMarking: boolean;
  onCancel: () => void;
  onReceived: () => void;
  selection: ReceiveUnitSelectionValue;
  t: WarehouseWorkTranslate;
  task: ReceivingTask;
}

const FIELDS = {
  actualQuantityBase: 'warehouseWork.measuredQuantity',
  defectiveMarkingCodes: 'warehouseWork.defectiveCodes',
  defectiveQuantityBase: 'warehouseWork.defective',
  gtin: 'warehouseWork.gtin',
  markingCodes: 'warehouseWork.markingCodes',
  quantityBase: 'warehouseWork.quantity',
  sscc: 'warehouseWork.sscc',
} as const;

export const WarehouseReceiveForm = ({
  hasEvidence, hasMarking, onCancel, onReceived, selection, t, task,
}: WarehouseReceiveFormProps): ReactElement => {
  const form = useReceiveUnitForm(task, selection, onReceived, {
    hasEvidence,
    hasMarking,
    translateViolation: (ruleId) => {
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
    },
  });
  const access = useCommandAccess(form.command.method, { kind: 'warehouse', warehouseId: task.warehouseId });
  const { cancelLeave, confirmLeave, isLeavePending, requestLeave } = useNavigationGuard(form.isDirty);
  const formRef = useRef<HTMLFormElement>(null);
  const isLabelled = selection.kind === 'labelled';
  const isPending = form.command.isPending;
  const fields: (keyof typeof FIELDS)[] = isLabelled ? ['sscc'] : ['gtin', 'quantityBase'];
  if (hasEvidence) {
    if (isLabelled) {
      fields.push('actualQuantityBase');
    }
    fields.push('defectiveQuantityBase');
  }
  if (hasMarking) {
    fields.push('markingCodes', 'defectiveMarkingCodes');
  }

  const handleScan: WarehouseScanHandlerValue = (raw, { resolveReceiving }) => {
    const result = resolveReceiving(raw, task, selection, hasMarking, {
      markingCodes: form.watchField('markingCodes'),
      sscc: form.watchField('sscc'),
    });
    if ('error' in result) {
      return result.error;
    }
    form.setFieldValue(result.field, result.value);
    return undefined;
  };

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
      {fields.map(name => (
        <TextField
          {...form.getFieldProps(name)}
          autoComplete="off"
          hint={name === 'markingCodes' ? t('warehouseWork.markingHint') : undefined}
          inputMode={name === 'markingCodes' || name === 'defectiveMarkingCodes' ? undefined : 'numeric'}
          key={name}
          label={t(FIELDS[name])}
          spellCheck={false}
        />
      ))}
      {access.status === 'allowed' && <WarehouseScanner isReadOnly={isPending || isLeavePending} onScan={handleScan} t={t} />}
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
        <Button disabled={isPending} onClick={handleCancel} variant="secondary">
          {t('warehouseWork.cancel')}
        </Button>
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
