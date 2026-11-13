import type { FormRulesValue } from '@skladburg/contracts/forms';
import type { ReceivingTask } from '@skladburg/contracts/wms/v1/receiving';

import {
  ReceiveHandlingUnitRequestFormRules,
  ReceivingBatchEvidenceFormRules,
  UnlabelledReceivingUnitFormRules,
} from '@skladburg/contracts/forms/wms/v1/receiving';
import { WarehouseReceivingService } from '@skladburg/contracts/wms/v1/receiving';

import type { CommandFormValue } from '@/shared/lib/form';

import { useApiClient } from '@/shared/api';
import { useCommandForm } from '@/shared/lib/form';

import type {
  ReceiveUnitEvidenceOptionsValue,
  ReceiveUnitFormValue,
  ReceiveUnitOutputValue,
  ReceiveUnitSelectionValue,
} from '../model/receiveUnitInput';

import {
  createReceiveUnitRequest,
  validateReceiveUnit,
} from '../model/receiveUnitInput';
import {
  useRefreshWarehouseWorkspace,
  useWarehouseCommandAttempt,
  warehouseTaskCommandRequest,
} from './useWarehouseCommands';

export type {
  ReceiveUnitFormValue,
  ReceiveUnitSelectionValue,
} from '../model/receiveUnitInput';

interface ReceiveUnitFormOptionsValue extends ReceiveUnitEvidenceOptionsValue {
  translateViolation?: ((ruleId: string) => string | undefined) | undefined;
}

const labelledRules = {
  sscc: { ...ReceiveHandlingUnitRequestFormRules.fields.sscc, isRequired: true },
} satisfies FormRulesValue['fields'];

const unlabelledRules = {
  gtin: { ...UnlabelledReceivingUnitFormRules.fields.gtin, isRequired: true },
  quantityBase: { ...UnlabelledReceivingUnitFormRules.fields.quantityBase, isRequired: true },
} satisfies FormRulesValue['fields'];

const defectRule = {
  defectiveQuantityBase: { ...ReceivingBatchEvidenceFormRules.fields.defectiveQuantityBase, hasPresence: true },
} satisfies FormRulesValue['fields'];

const measuredRule = {
  actualQuantityBase: ReceivingBatchEvidenceFormRules.fields.quantityBase,
} satisfies FormRulesValue['fields'];

const mapViolationPath = (path: string, selection: ReceiveUnitSelectionValue): string => {
  const normalized = path.replace(/^batch_evidence\[0\]\./u, 'batch_evidence.').replace(/\[\d+\]$/u, '');
  switch (normalized) {
    case 'batch_evidence.defective_marking_codes':
      return 'defectiveMarkingCodes';
    case 'batch_evidence.defective_quantity_base':
      return 'defectiveQuantityBase';
    case 'batch_evidence.marking_codes':
      return 'markingCodes';
    case 'batch_evidence.quantity_base':
      return selection.kind === 'labelled' ? 'actualQuantityBase' : 'quantityBase';
    case 'unlabelled_unit.gtin':
      return 'gtin';
    case 'unlabelled_unit.quantity_base':
      return 'quantityBase';
    default:
      return path;
  }
};

export const useReceiveUnitForm = (
  task: ReceivingTask,
  selection: ReceiveUnitSelectionValue,
  onSuccess: () => void,
  options: ReceiveUnitFormOptionsValue = {},
): CommandFormValue<ReceiveUnitFormValue> => {
  const client = useApiClient();
  const refresh = useRefreshWarehouseWorkspace(task.warehouseId, onSuccess);
  const attempt = useWarehouseCommandAttempt();
  const isLabelled = selection.kind === 'labelled';
  const expected = task.expectedUnits.find(unit => unit.id === selection.expectedUnitId);
  const rules: FormRulesValue = {
    fields: {
      ...(isLabelled ? labelledRules : unlabelledRules),
      ...(options.hasEvidence ? defectRule : {}),
      ...(isLabelled && options.hasEvidence ? measuredRule : {}),
    },
  };

  return useCommandForm<ReceiveUnitFormValue, unknown, ReceiveUnitOutputValue>({
    defaultValues: {
      actualQuantityBase: '',
      defectiveMarkingCodes: '',
      defectiveQuantityBase: '',
      gtin: isLabelled ? '' : selection.gtin,
      markingCodes: '',
      quantityBase: '',
      sscc: isLabelled ? expected?.sscc ?? '' : '',
    },
    execute: (values, idempotencyKey) => attempt(idempotencyKey, () => client.service(WarehouseReceivingService).receiveHandlingUnit({
      ...warehouseTaskCommandRequest(task, idempotencyKey),
      ...createReceiveUnitRequest(task, selection, values, options),
    })),
    mapViolationPath: path => mapViolationPath(path, selection),
    method: WarehouseReceivingService.method.receiveHandlingUnit,
    onSuccess: refresh,
    rules,
    translateViolation: options.translateViolation,
    validateValues: values => validateReceiveUnit(task, selection, values, options),
  });
};
