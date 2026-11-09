import type { CatalogShapeValue } from '@/shared/i18n';

export const catalog = {
  'documentType.contract': 'Договор поставки',
  'documentType.dealReference': 'Сделка № {number}',
  'documentType.generic': 'Документ',
  'documentType.invoice': 'Счёт',
  'documentType.specification': 'Спецификация',
} as const satisfies CatalogShapeValue;
