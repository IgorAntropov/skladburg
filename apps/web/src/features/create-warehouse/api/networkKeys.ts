interface NetworkKeysValue {
  all: readonly ['network'];
  warehousePlaces: () => readonly ['network', 'warehouse-places'];
}

export const networkKeys: NetworkKeysValue = {
  all: ['network'],
  warehousePlaces: () => ['network', 'warehouse-places'],
};
