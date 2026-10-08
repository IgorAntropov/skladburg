import { catalog } from '../../src/shared/i18n/catalogs/ru.ts';

export const messages = catalog;

export type MessageKey = keyof typeof messages;

export const getText = (key: MessageKey): string => {
  const message = messages[key];

  if (typeof message !== 'string') {
    throw new TypeError(`The message ${key} has plural forms`);
  }

  return message;
};
