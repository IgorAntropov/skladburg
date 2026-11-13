import type { CatalogShapeValue } from '@/shared/i18n';

export const catalog = {
  'printLabels.close': 'Закрыть',
  'printLabels.failed': 'Не удалось подготовить печать.',
  'printLabels.loading': 'Готовим страницы…',
  'printLabels.preview': 'Предпросмотр печати',
  'printLabels.submit': 'Печатать',
} as const satisfies CatalogShapeValue;
