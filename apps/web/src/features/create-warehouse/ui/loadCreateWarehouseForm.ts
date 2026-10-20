type CreateWarehouseFormModuleValue = typeof import('./form/CreateWarehouseForm');

export const loadCreateWarehouseForm = (): Promise<CreateWarehouseFormModuleValue> => import('./form/CreateWarehouseForm');
