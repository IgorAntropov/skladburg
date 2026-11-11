import type {
  PostOpeningStockRequest,
  PostOpeningStockResponse,
} from '@skladburg/contracts/wms/v1/stock';

import type { PermissionCallerValue } from '../../access/index';
import type { IStateTransaction } from '../../state/index';
import type { IModuleRuntime } from '../moduleRuntime';

import {
  applyOpeningStockPlan,
  planOpeningStock,
} from './openingStockPlan';

export const postOpeningStock = (
  transaction: IStateTransaction,
  runtime: IModuleRuntime,
  caller: PermissionCallerValue,
  request: PostOpeningStockRequest,
): PostOpeningStockResponse => {
  const plan = planOpeningStock(transaction, runtime.errors, caller.organizationId, request.warehouseId, [request]);
  const [response] = applyOpeningStockPlan(transaction, runtime, caller, plan);

  if (response === undefined) {
    throw runtime.errors.internal();
  }

  return response;
};
