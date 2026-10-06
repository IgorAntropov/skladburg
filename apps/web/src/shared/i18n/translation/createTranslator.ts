import type {
  MessageOverridesValue,
  Translate,
} from '../localizer/localizationTypes';
import type {
  LocaleCode,
  MessageValue,
} from '../localizer/messageShape';

import {
  getNumberFormat,
  getPluralRules,
} from './intlCache';

export type MessageParamsValue = Readonly<Record<string, number | string>>;

export type RuntimeTranslate = (key: string, params?: MessageParamsValue) => string;

export interface TranslatorOptionsValue {
  layers: readonly MessageOverridesValue[];
  locale: LocaleCode;
}

const PLACEHOLDER_PATTERN = /\{(\w+)\}/g;

const findMessage = (layers: readonly MessageOverridesValue[], key: string): MessageValue | undefined => {
  for (let index = layers.length - 1; index >= 0; index -= 1) {
    const layer = layers[index];

    if (layer !== undefined && Object.hasOwn(layer, key)) {
      const message = layer[key];

      if (message !== undefined) {
        return message;
      }
    }
  }

  return undefined;
};

const selectText = (message: MessageValue, locale: LocaleCode, params: MessageParamsValue | undefined): string => {
  if (typeof message === 'string') {
    return message;
  }

  const count = params?.count;

  if (typeof count !== 'number') {
    return message.other;
  }

  return message[getPluralRules(locale).select(count)] ?? message.other;
};

const interpolate = (text: string, locale: LocaleCode, params: MessageParamsValue | undefined): string => {
  if (params === undefined) {
    return text;
  }

  return text.replace(PLACEHOLDER_PATTERN, (placeholder: string, name: string): string => {
    const value = Object.hasOwn(params, name) ? params[name] : undefined;

    if (value === undefined) {
      return placeholder;
    }

    return typeof value === 'number' ? getNumberFormat(locale).format(value) : value;
  });
};

export const createTranslator = ({ layers, locale }: TranslatorOptionsValue): RuntimeTranslate => {
  return (key, params): string => {
    const message = findMessage(layers, key);

    if (message === undefined) {
      return key;
    }

    return interpolate(selectText(message, locale, params), locale, params);
  };
};

export const createTranslate = (translate: RuntimeTranslate): Translate => {
  return (key, ...params): string => translate(key, params.at(0));
};
