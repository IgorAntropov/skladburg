export const SECTIONS = ['network', 'catalog', 'deals', 'warehouse'] as const;

export interface ObjectRouteValue {
  id: string;
  section: SectionValue;
  segment: string;
}

export type SectionValue = typeof SECTIONS[number];

export const DEAL_ROUTE: ObjectRouteValue = {
  id: 'f6000001-0000-4000-8000-000000000000',
  section: 'deals',
  segment: 'deals',
};

export const FIRST_SECTION: SectionValue = 'network';

export const toSectionHash = (section: SectionValue): string => `#/${section}`;

export const toObjectHash = ({ id, segment }: ObjectRouteValue): string => `#/${segment}/${id}`;
