import type { CatalogShapeValue } from '../../localizer/messageShape';
import type {
  CatalogSectionValue,
  SectionLocaleCatalogValue,
} from '../sectionTypes';

import { createCatalogSection } from '../createCatalogSection';

export const ruSectionCatalog = {
  'probe.count': {
    few: '{count} штуки',
    many: '{count} штук',
    one: '{count} штука',
    other: '{count} штуки',
  },
  'probe.greeting': 'Здравствуйте, {name}',
  'probe.title': 'Заголовок',
} as const satisfies CatalogShapeValue;

export type ProbeCatalogValue = typeof ruSectionCatalog;

export const enSectionCatalog: SectionLocaleCatalogValue<ProbeCatalogValue> = {
  'probe.count': { one: '{count} item', other: '{count} items' },
  'probe.greeting': 'Hello, {name}',
  'probe.title': 'Title',
};

export const createProbeSection = (
  loaders: Parameters<typeof createCatalogSection<ProbeCatalogValue>>[0]['loaders'],
): CatalogSectionValue<ProbeCatalogValue> => {
  return createCatalogSection<ProbeCatalogValue>({ loaders, prefix: 'probe' });
};
