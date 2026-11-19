import type { FormRulesValue } from '@skladburg/contracts/forms';
import type { ConfigureWarehouseReceivingLayoutResponse } from '@skladburg/contracts/wms/v1/receiving_layout';

import {
  ConfigureWarehouseReceivingLayoutRequestFormRules,
  WarehouseDockPlacementInputFormRules,
} from '@skladburg/contracts/forms/wms/v1/receiving_layout';
import { WarehouseReceivingLayoutService } from '@skladburg/contracts/wms/v1/receiving_layout';

import type { CommandFormValue } from '@/shared/lib/form';

import { useApiClient } from '@/shared/api';
import { useCommandForm } from '@/shared/lib/form';

import type { WarehouseWorkTranslate } from '../i18n/workspaceSection';
import type {
  ReceivingLayoutDefaultsValue,
  ReceivingLayoutFormValue,
} from '../model/warehouseReceivingLayout';

import { createReceivingLayoutGeometry } from '../model/warehouseReceivingLayout';
import {
  useRefreshWarehouseWorkspace,
  useWarehouseCommandAttempt,
} from './useWarehouseCommands';

export const RECEIVING_LAYOUT_DOCK_CAPACITY = ConfigureWarehouseReceivingLayoutRequestFormRules.fields.docks.maxItems;

const MAX_UINT32 = 4_294_967_295;
const requiredInteger = { hasPresence: true, isRequired: true, lte: MAX_UINT32 } as const;
const originRule = { ...requiredInteger, gte: 0, kind: 'integer', type: 'uint32' } as const;
const fields = ConfigureWarehouseReceivingLayoutRequestFormRules.fields;
const dockPositionField = WarehouseDockPlacementInputFormRules.fields.xMm;
const watchedFields = ['dockCount'] as const;
const rules = {
  fields: {
    ...fields,
    'receivingFootprint.depthMm': { ...fields['receivingFootprint.depthMm'], ...requiredInteger },
    'receivingFootprint.origin.xMm': { ...originRule, protoName: 'receiving_footprint.origin.x_mm' },
    'receivingFootprint.origin.zMm': { ...originRule, protoName: 'receiving_footprint.origin.z_mm' },
    'receivingFootprint.widthMm': { ...fields['receivingFootprint.widthMm'], ...requiredInteger },
    ...Object.fromEntries(Array.from({ length: RECEIVING_LAYOUT_DOCK_CAPACITY }, (_unused, index) => [
      `docks.${String(index)}.xMm`,
      { ...dockPositionField, gte: 0, lte: MAX_UINT32, protoName: `docks[${String(index)}].x_mm` },
    ])),
  },
} satisfies FormRulesValue;

const mapViolationPath = (path: string): string => {
  if (path === 'receiving_footprint' || path === 'receiving_footprint.origin') {
    return 'receiving_footprint.origin.x_mm';
  }
  if (path === 'docks') {
    return 'docks[0].x_mm';
  }

  return path.replace(/^(docks\[\d+\])\.(?:unloading_point_id|capabilities)(?:\[\d+\])?$/u, '$1.x_mm');
};

const violationText = (ruleId: string, t: WarehouseWorkTranslate): string | undefined => {
  switch (ruleId) {
    case 'warehouse.dock_approach_blocked':
      return t('warehouseWork.receivingLayoutDockApproach');
    case 'warehouse.dock_capabilities':
      return t('warehouseWork.receivingLayoutDockCapabilities');
    case 'warehouse.dock_duplicate':
    case 'warehouse.dock_missing':
    case 'warehouse.dock_unknown':
      return t('warehouseWork.receivingLayoutDockChanged');
    case 'warehouse.dock_outside_receiving':
      return t('warehouseWork.receivingLayoutDockOutside');
    case 'warehouse.dock_spacing':
      return t('warehouseWork.receivingLayoutDockSpacing');
    case 'warehouse.receiving_grid_step':
      return t('warehouseWork.initializeGridStep');
    case 'warehouse.receiving_min_size':
      return t('warehouseWork.receivingLayoutMinSize');
    case 'warehouse.receiving_outside_floor':
      return t('warehouseWork.receivingLayoutOutside');
    case 'warehouse.receiving_storage_overlap':
      return t('warehouseWork.receivingLayoutOverlap');
    default:
      return undefined;
  }
};

export const useConfigureWarehouseReceivingLayoutForm = (
  warehouseId: string,
  expectedRevision: number,
  defaults: ReceivingLayoutDefaultsValue,
  onSuccess: () => void,
  t: WarehouseWorkTranslate,
): CommandFormValue<ReceivingLayoutFormValue> => {
  const client = useApiClient();
  const refresh = useRefreshWarehouseWorkspace(warehouseId, onSuccess);
  const attempt = useWarehouseCommandAttempt<ConfigureWarehouseReceivingLayoutResponse>();

  return useCommandForm<ReceivingLayoutFormValue, ConfigureWarehouseReceivingLayoutResponse, ReceivingLayoutFormValue<number>>({
    defaultValues: defaults.values,
    execute: (values, idempotencyKey) => attempt(idempotencyKey, () =>
      client.service(WarehouseReceivingLayoutService).configureWarehouseReceivingLayout({
        ...createReceivingLayoutGeometry(defaults, values), expectedRevision, idempotencyKey, warehouseId,
      })),
    mapViolationPath,
    method: WarehouseReceivingLayoutService.method.configureWarehouseReceivingLayout,
    onSuccess: refresh,
    rules,
    translateViolation: ruleId => violationText(ruleId, t),
    watchedFields,
  });
};
