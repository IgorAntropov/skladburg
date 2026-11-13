import type { CatalogShapeValue } from '@/shared/i18n';

export const catalog = {
  'documentType.contract': 'Договор поставки',
  'documentType.dealReference': 'Сделка № {number}',
  'documentType.dispatchTitle': 'Титул грузоотправителя',
  'documentType.generic': 'Документ',
  'documentType.invoice': 'Счёт',
  'documentType.receiptClaim': 'Претензия',
  'documentType.receiptDiscrepancyAct': 'Акт о расхождениях',
  'documentType.receiptTitle': 'Титул грузополучателя',
  'documentType.specification': 'Спецификация',
  'documentType.upd': 'УПД',
} as const satisfies CatalogShapeValue;
