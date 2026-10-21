interface WarehouseKeysValue {
  list: (organizationId: string) => readonly ['warehouse', 'list', string];
}

export const warehouseKeys: WarehouseKeysValue = {
  list: organizationId => ['warehouse', 'list', organizationId],
};
