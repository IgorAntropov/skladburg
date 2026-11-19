import type {
  AssignYardVisitToDockResponse,
  PromoteYardVisitResponse,
} from '@skladburg/contracts/wms/v1/receiving';

import {
  AssignYardVisitToDockRequestFormRules,
  PromoteYardVisitRequestFormRules,
} from '@skladburg/contracts/forms/wms/v1/receiving';
import { WarehouseReceivingService } from '@skladburg/contracts/wms/v1/receiving';

import type { CommandFormValue } from '@/shared/lib/form';

import { useApiClient } from '@/shared/api';
import { useCommandForm } from '@/shared/lib/form';

import type { WarehouseWorkTranslate } from '../i18n/workspaceSection';
import type { YardDispatchActionValue } from '../model/yardDispatchDraft';

import {
  useRefreshWarehouseWorkspace,
  useWarehouseCommandAttempt,
} from './useWarehouseCommands';

export type YardDispatchResultValue = AssignYardVisitToDockResponse | PromoteYardVisitResponse;

interface YardDispatchFormOptionsValue {
  action: YardDispatchActionValue;
  expectedVersion: number;
  initialDockId: string;
  onSuccess: (result: YardDispatchResultValue) => void;
  t: WarehouseWorkTranslate;
  taskId: string;
  warehouseId: string;
}

interface YardDispatchFormValue {
  reason: string;
  unloadingPointId: string;
}

export const yardDispatchMethods = WarehouseReceivingService.method;

const ASSIGN_RULES = {
  fields: {
    reason: AssignYardVisitToDockRequestFormRules.fields.reason,
    unloadingPointId: { ...AssignYardVisitToDockRequestFormRules.fields.unloadingPointId, minLen: 1 },
  },
};
const PROMOTE_RULES = { fields: { reason: PromoteYardVisitRequestFormRules.fields.reason } };
const WATCHED_FIELDS = ['unloadingPointId'] as const;

export const useYardDispatchForm = ({
  action, expectedVersion, initialDockId, onSuccess, t, taskId, warehouseId,
}: YardDispatchFormOptionsValue): CommandFormValue<YardDispatchFormValue> => {
  const client = useApiClient();
  const attempt = useWarehouseCommandAttempt<YardDispatchResultValue>();
  const refresh = useRefreshWarehouseWorkspace(warehouseId, () => undefined);
  const isAssign = action === 'assign';

  return useCommandForm<YardDispatchFormValue, YardDispatchResultValue>({
    defaultValues: { reason: '', unloadingPointId: initialDockId },
    execute: ({ reason, unloadingPointId }, idempotencyKey) => attempt(idempotencyKey, () => {
      const service = client.service(WarehouseReceivingService);
      const request = { expectedVersion, idempotencyKey, reason: reason.trim(), taskId, warehouseId };
      return isAssign ? service.assignYardVisitToDock({ ...request, unloadingPointId }) : service.promoteYardVisit(request);
    }),
    method: isAssign ? yardDispatchMethods.assignYardVisitToDock : yardDispatchMethods.promoteYardVisit,
    onSuccess: (result) => {
      refresh();
      onSuccess(result);
    },
    rules: isAssign ? ASSIGN_RULES : PROMOTE_RULES,
    translateViolation: ruleId => ruleId === 'yard_dispatch.reason_required' ? t('warehouseWork.yardDispatchReasonRequired') : undefined,
    validateValues: ({ reason }) => reason.trim() === '' ? [{ field: 'reason', ruleId: 'yard_dispatch.reason_required' }] : [],
    watchedFields: WATCHED_FIELDS,
  });
};
