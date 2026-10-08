import { getText } from './messages.ts';

export const SECTIONS = ['network', 'catalog', 'deals', 'warehouse'] as const;

export type SectionValue = typeof SECTIONS[number];

export const OBJECT_TYPES = [
  'deal',
  'document',
  'dashboard',
  'handling_unit',
  'cell',
  'vehicle',
  'trip',
  'warehouse',
] as const;

export interface ObjectRouteValue {
  id: string;
  section: SectionValue;
  segment: string;
  type: ObjectTypeValue;
}

export type ObjectTypeValue = typeof OBJECT_TYPES[number];

export const OBJECT_ID = 'f6000001-0000-4000-8000-000000000000';

export const DEAL_ROUTE: ObjectRouteValue = { id: OBJECT_ID, section: 'deals', segment: 'deals', type: 'deal' };

export const OBJECT_ROUTES: readonly ObjectRouteValue[] = [
  DEAL_ROUTE,
  { id: OBJECT_ID, section: 'deals', segment: 'documents', type: 'document' },
  { id: 'stock-overview', section: 'network', segment: 'dashboards', type: 'dashboard' },
  { id: OBJECT_ID, section: 'warehouse', segment: 'handling-units', type: 'handling_unit' },
  { id: OBJECT_ID, section: 'warehouse', segment: 'cells', type: 'cell' },
  { id: OBJECT_ID, section: 'network', segment: 'vehicles', type: 'vehicle' },
  { id: OBJECT_ID, section: 'network', segment: 'trips', type: 'trip' },
  { id: OBJECT_ID, section: 'warehouse', segment: 'warehouses', type: 'warehouse' },
];

export const FIRST_SECTION: SectionValue = 'network';

export const toSectionHash = (section: SectionValue): string => `#/${section}`;

export const toObjectHash = ({ id, segment }: ObjectRouteValue): string => `#/${segment}/${id}`;

export const getSectionTitle = (section: SectionValue): string => getText(`section.${section}.title`);
