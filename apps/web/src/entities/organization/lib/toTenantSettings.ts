import type {
  MessageOverride,
  OrganizationSettings,
  PluralForms,
} from '@skladburg/contracts/organization/v1/organization';

import type {
  MessageValue,
  PluralFormsValue,
  TermOverridesValue,
} from '@/shared/i18n';
import type { TenantSettingsValue } from '@/shared/tenant';

const toPluralForms = (plural: PluralForms): PluralFormsValue => ({
  ...(plural.zero !== undefined && { zero: plural.zero }),
  ...(plural.one !== undefined && { one: plural.one }),
  ...(plural.two !== undefined && { two: plural.two }),
  ...(plural.few !== undefined && { few: plural.few }),
  ...(plural.many !== undefined && { many: plural.many }),
  other: plural.other,
});

const toMessageValue = (override: MessageOverride): MessageValue | undefined => {
  const { value } = override;

  if (value.case === 'text') {
    return value.value;
  }

  if (value.case === 'plural') {
    return toPluralForms(value.value);
  }

  return undefined;
};

const toTermOverrides = (settings: OrganizationSettings): TermOverridesValue => {
  const messagesByLocale = new Map<string, Map<string, MessageValue>>();

  for (const { locale, messages } of settings.termOverrides) {
    const localeMessages = messagesByLocale.get(locale) ?? new Map<string, MessageValue>();

    for (const [key, override] of Object.entries(messages)) {
      const messageValue = toMessageValue(override);

      if (messageValue !== undefined) {
        localeMessages.set(key, messageValue);
      }
    }

    messagesByLocale.set(locale, localeMessages);
  }

  return Object.fromEntries(
    Array.from(messagesByLocale, ([locale, localeMessages]) => [locale, Object.fromEntries(localeMessages)]),
  );
};

export const toTenantSettings = (settings: OrganizationSettings): TenantSettingsValue => ({
  availableLocales: settings.availableLocales,
  brandName: settings.brandName,
  defaultLocale: settings.defaultLocale,
  tenantId: settings.organizationId,
  termOverrides: toTermOverrides(settings),
});
