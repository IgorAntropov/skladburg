export interface CreateWarehouseFormValues {
  address: string;
  cityId: string;
  name: string;
}

export const CREATE_WAREHOUSE_DEFAULT_VALUES: CreateWarehouseFormValues = {
  address: '',
  cityId: '',
  name: '',
};
