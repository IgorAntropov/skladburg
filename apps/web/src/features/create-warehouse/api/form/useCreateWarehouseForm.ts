import type { Warehouse } from '@skladburg/contracts/organization/v1/organization';

import { CreateWarehouseRequestFormRules } from '@skladburg/contracts/forms/organization/v1/organization';
import { OrganizationService } from '@skladburg/contracts/organization/v1/organization';

import type { CommandFormValue } from '@/shared/lib/form';

import { useApiClient } from '@/shared/api';
import { useCommandForm } from '@/shared/lib/form';

import type { CreateWarehouseFormValues } from '../../model/createWarehouseFormValues';
import type { WarehousePlacesValue } from '../../model/warehousePlacesTypes';

import { resolveWarehousePlacement } from '../../lib/resolveWarehousePlacement';
import { CREATE_WAREHOUSE_DEFAULT_VALUES } from '../../model/createWarehouseFormValues';

export interface UseCreateWarehouseFormOptions {
  onCreated: (warehouse: Warehouse) => void;
  places: WarehousePlacesValue;
}

export const useCreateWarehouseForm = ({
  onCreated,
  places,
}: UseCreateWarehouseFormOptions): CommandFormValue<CreateWarehouseFormValues> => {
  const client = useApiClient();

  const execute = async (values: CreateWarehouseFormValues, idempotencyKey: string): Promise<Warehouse> => {
    const placement = resolveWarehousePlacement(values.cityId, places);
    const response = await client.organization.createWarehouse({
      address: values.address,
      cityId: values.cityId,
      idempotencyKey,
      name: values.name,
      ...placement,
    });

    if (response.warehouse === undefined) {
      throw new TypeError('The server did not return the created warehouse');
    }

    return response.warehouse;
  };

  return useCommandForm<CreateWarehouseFormValues, Warehouse>({
    defaultValues: CREATE_WAREHOUSE_DEFAULT_VALUES,
    execute,
    method: OrganizationService.method.createWarehouse,
    onSuccess: onCreated,
    rules: CreateWarehouseRequestFormRules,
  });
};
