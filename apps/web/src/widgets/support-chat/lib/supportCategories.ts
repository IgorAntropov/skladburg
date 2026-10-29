import { SupportTicketCategory } from '@skladburg/contracts/support/v1/support_ticket';

import type { SupportCatalogValue } from '../i18n/supportSection';

export interface SupportCategoryDescriptorValue {
  hintKey: keyof SupportCatalogValue;
  isUrgent: boolean;
  nameKey: keyof SupportCatalogValue;
  optionKey: keyof SupportCatalogValue;
}

export type SupportSelectableCategoryValue = Exclude<SupportTicketCategory, SupportTicketCategory.UNSPECIFIED>;

export const SUPPORT_CATEGORY_DESCRIPTORS = {
  [SupportTicketCategory.ERROR]: {
    hintKey: 'support.category.error.hint',
    isUrgent: false,
    nameKey: 'support.category.error',
    optionKey: 'support.categoryOption.error',
  },
  [SupportTicketCategory.GENERAL]: {
    hintKey: 'support.category.general.hint',
    isUrgent: false,
    nameKey: 'support.category.general',
    optionKey: 'support.categoryOption.general',
  },
  [SupportTicketCategory.MONEY]: {
    hintKey: 'support.category.money.hint',
    isUrgent: true,
    nameKey: 'support.category.money',
    optionKey: 'support.categoryOption.money',
  },
  [SupportTicketCategory.RECEIVING_BLOCKED]: {
    hintKey: 'support.category.receivingBlocked.hint',
    isUrgent: true,
    nameKey: 'support.category.receivingBlocked',
    optionKey: 'support.categoryOption.receivingBlocked',
  },
} as const satisfies Record<SupportSelectableCategoryValue, SupportCategoryDescriptorValue>;

export const SUPPORT_CATEGORIES: readonly SupportSelectableCategoryValue[] = [
  SupportTicketCategory.GENERAL,
  SupportTicketCategory.ERROR,
  SupportTicketCategory.MONEY,
  SupportTicketCategory.RECEIVING_BLOCKED,
];

export const SUPPORT_RESPONSE_HOURS = { normal: 8, urgent: 1 } as const;

export const resolveDefaultSupportCategory = (hasErrors: boolean): SupportSelectableCategoryValue => (
  hasErrors ? SupportTicketCategory.ERROR : SupportTicketCategory.GENERAL
);

export const findSupportCategory = (value: string): SupportSelectableCategoryValue | undefined => (
  SUPPORT_CATEGORIES.find(category => String(category) === value)
);

export const getSupportCategoryDescriptor = (
  category: SupportTicketCategory,
): (typeof SUPPORT_CATEGORY_DESCRIPTORS)[SupportSelectableCategoryValue] | undefined => (
  category === SupportTicketCategory.UNSPECIFIED ? undefined : SUPPORT_CATEGORY_DESCRIPTORS[category]
);
