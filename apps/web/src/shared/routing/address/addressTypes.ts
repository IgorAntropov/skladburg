export const APP_SECTIONS = ['network', 'catalog', 'deals', 'warehouse'] as const;

export type AppSectionValue = typeof APP_SECTIONS[number];

export const OBJECT_TYPES = ['deal', 'document', 'dashboard', 'handling_unit', 'cell', 'vehicle', 'trip', 'warehouse'] as const;

export type AppAddressValue
  = | { kind: 'home' }
    | { kind: 'object'; object: ObjectRefValue }
    | { kind: 'section'; section: AppSectionValue };

export interface ObjectRefValue {
  id: string;
  type: ObjectTypeValue;
}

export type ObjectTypeValue = typeof OBJECT_TYPES[number];

export const OBJECT_HOME_SECTION: Readonly<Record<ObjectTypeValue, AppSectionValue>> = {
  cell: 'warehouse',
  dashboard: 'network',
  deal: 'deals',
  document: 'deals',
  handling_unit: 'warehouse',
  trip: 'network',
  vehicle: 'network',
  warehouse: 'warehouse',
};

export const OBJECT_PATH_SEGMENTS: Readonly<Record<ObjectTypeValue, string>> = {
  cell: 'cells',
  dashboard: 'dashboards',
  deal: 'deals',
  document: 'documents',
  handling_unit: 'handling-units',
  trip: 'trips',
  vehicle: 'vehicles',
  warehouse: 'warehouses',
};
