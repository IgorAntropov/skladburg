export const APP_SECTIONS = ['network', 'catalog', 'deals', 'warehouse', 'garage', 'transport'] as const;

export type AppSectionValue = typeof APP_SECTIONS[number];

interface ObjectRouteValue {
  section: AppSectionValue;
  segment: string;
}

export const OBJECT_ROUTES = {
  cell: { section: 'warehouse', segment: 'cells' },
  city: { section: 'network', segment: 'cities' },
  dashboard: { section: 'network', segment: 'dashboards' },
  deal: { section: 'deals', segment: 'deals' },
  document: { section: 'deals', segment: 'documents' },
  handling_unit: { section: 'warehouse', segment: 'handling-units' },
  listing: { section: 'catalog', segment: 'listings' },
  organization: { section: 'network', segment: 'organizations' },
  site: { section: 'network', segment: 'sites' },
  transport_request: { section: 'transport', segment: 'transport-requests' },
  trip: { section: 'transport', segment: 'trips' },
  vehicle: { section: 'network', segment: 'vehicles' },
  warehouse: { section: 'warehouse', segment: 'warehouses' },
} satisfies Record<string, ObjectRouteValue>;

export type ObjectTypeValue = keyof typeof OBJECT_ROUTES;

export const OBJECT_TYPES: readonly ObjectTypeValue[] = Object.keys(OBJECT_ROUTES) as ObjectTypeValue[];

export type AppAddressValue
  = | { kind: 'home' }
    | { kind: 'object'; object: ObjectRefValue }
    | { kind: 'section'; section: AppSectionValue };

export interface ObjectRefValue {
  id: string;
  type: ObjectTypeValue;
}
