import type { FormRulesValue } from '@skladburg/contracts/forms';
import type { InitializeWarehouseLayoutResponse } from '@skladburg/contracts/wms/v1/topology';

import { InitializeWarehouseLayoutRequestFormRules } from '@skladburg/contracts/forms/wms/v1/topology';
import { WarehouseTopologyService } from '@skladburg/contracts/wms/v1/topology';

import type { CommandFormValue } from '@/shared/lib/form';

import { useApiClient } from '@/shared/api';
import { useCommandForm } from '@/shared/lib/form';

import type { WarehouseWorkTranslate } from '../i18n/workspaceSection';

import {
  useRefreshWarehouseWorkspace,
  useWarehouseCommandAttempt,
} from './useWarehouseCommands';

export interface InitializeWarehouseLayoutFormValue<T extends number | string = string> {
  warehouseDepthMm: T;
  warehouseWidthMm: T;
  zoneBounds: {
    depthMm: T;
    origin: { xMm: T; zMm: T };
    widthMm: T;
  };
}

export const INITIAL_WAREHOUSE_LAYOUT = {
  warehouseDepthMm: '8000',
  warehouseWidthMm: '12000',
  zoneBounds: { depthMm: '4000', origin: { xMm: '1000', zMm: '1000' }, widthMm: '6000' },
} satisfies InitializeWarehouseLayoutFormValue;

const requiredInteger = { hasPresence: true, isRequired: true } as const;
const fields = InitializeWarehouseLayoutRequestFormRules.fields;
const maxPlanDimensionMm = fields.warehouseWidthMm.lte;
const originRule = { ...requiredInteger, gte: 0, kind: 'integer', lte: maxPlanDimensionMm, type: 'uint32' } as const;
const rules = {
  fields: {
    ...fields,
    'warehouseDepthMm': { ...fields.warehouseDepthMm, ...requiredInteger },
    'warehouseWidthMm': { ...fields.warehouseWidthMm, ...requiredInteger },
    'zoneBounds.depthMm': { ...fields['zoneBounds.depthMm'], ...requiredInteger, lte: maxPlanDimensionMm },
    'zoneBounds.origin.xMm': { ...originRule, protoName: 'zone_bounds.origin.x_mm' },
    'zoneBounds.origin.zMm': { ...originRule, protoName: 'zone_bounds.origin.z_mm' },
    'zoneBounds.widthMm': { ...fields['zoneBounds.widthMm'], ...requiredInteger, lte: maxPlanDimensionMm },
  },
} satisfies FormRulesValue;

const violationText = (ruleId: string, t: WarehouseWorkTranslate): string | undefined => {
  switch (ruleId) {
    case 'uint32.gt_lte':
    case 'uint32.gte_lte':
      return t('warehouseWork.initializeRange');
    case 'warehouse.layout_grid_step':
      return t('warehouseWork.initializeGridStep');
    case 'warehouse.zone_min_size':
      return t('warehouseWork.initializeZoneRange');
    case 'warehouse.zone_outside_warehouse':
      return t('warehouseWork.initializeZoneOverflow');
    default:
      return undefined;
  }
};

export const useInitializeWarehouseLayoutForm = (
  warehouseId: string,
  expectedRevision: number,
  onSuccess: () => void,
  t: WarehouseWorkTranslate,
): CommandFormValue<InitializeWarehouseLayoutFormValue> => {
  const client = useApiClient();
  const refresh = useRefreshWarehouseWorkspace(warehouseId, onSuccess);
  const attempt = useWarehouseCommandAttempt<InitializeWarehouseLayoutResponse>();

  return useCommandForm<InitializeWarehouseLayoutFormValue, InitializeWarehouseLayoutResponse, InitializeWarehouseLayoutFormValue<number>>({
    defaultValues: INITIAL_WAREHOUSE_LAYOUT,
    execute: (values, idempotencyKey) => attempt(idempotencyKey, () => client.service(WarehouseTopologyService).initializeWarehouseLayout({
      ...values, expectedRevision, idempotencyKey, warehouseId,
    })),
    method: WarehouseTopologyService.method.initializeWarehouseLayout,
    onSuccess: refresh,
    rules,
    translateViolation: ruleId => violationText(ruleId, t),
  });
};
