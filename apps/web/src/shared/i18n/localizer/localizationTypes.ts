import type { catalog } from '../catalogs/ru';
import type {
  LocaleCode,
  MessageValue,
  PluralFormsValue,
} from './messageShape';

export interface CalendarDateValue {
  day: number;
  month: number;
  year: number;
}

export type CatalogLoader = () => Promise<LocaleCatalogValue>;

export type CatalogLoadersValue = Readonly<Partial<Record<LocaleCode, CatalogLoader>>>;

export type DateTimeFormatPartsValue = Omit<Intl.DateTimeFormatOptions, 'timeZone' | 'timeZoneName'>;

export interface I18nSnapshotValue {
  formatCalendarDate: (date: CalendarDateValue, format?: DateTimeFormatPartsValue) => string;
  formatCurrency: (amount: number, currencyCode: string) => string;
  formatDateTime: (instant: Date | number, options: ZonedDateTimeOptionsValue) => string;
  formatNumber: (amount: number, options?: Intl.NumberFormatOptions) => string;
  locale: LocaleCode;
  t: Translate;
  userTimeZone: string;
}

export interface ILocalizer {
  applyTenant: (tenant: TenantLocalizationValue) => Promise<void>;
  getSnapshot: () => I18nSnapshotValue;
  setLocale: (locale: LocaleCode) => Promise<void>;
  subscribe: (listener: () => void) => () => void;
}

export type LocaleCatalogValue = {
  readonly [Key in MessageKey]: ReferenceCatalogValue[Key] extends string ? string : PluralFormsValue;
};

export interface LocalizerOptionsValue {
  bundledLocales: readonly LocaleCode[];
  catalogLoaders: CatalogLoadersValue;
  requestedLocale: LocaleCode | undefined;
  tenant: TenantLocalizationValue;
  userTimeZone: string;
}

export type MessageKey = Extract<keyof ReferenceCatalogValue, string>;

export type MessageOverridesValue = Readonly<Partial<Record<string, MessageValue>>>;

export type MessageParamsArgs<Key extends MessageKey> = ReferenceCatalogValue[Key] extends string
  ? [PlaceholderNames<MessageText<Key>>] extends [never]
      ? []
      : [params: TextParamsValue<PlaceholderNames<MessageText<Key>>>]
  : [params: PluralParamsValue<PlaceholderNames<MessageText<Key>>>];

export type ResolveLocaleOptionsValue = Pick<LocalizerOptionsValue, 'bundledLocales' | 'requestedLocale' | 'tenant'>;

export interface TenantLocalizationValue {
  availableLocales: readonly LocaleCode[];
  defaultLocale: LocaleCode;
  termOverrides: TermOverridesValue;
}

export type TermOverridesValue = Readonly<Partial<Record<LocaleCode, MessageOverridesValue>>>;

export type Translate = <Key extends MessageKey>(key: Key, ...params: MessageParamsArgs<Key>) => string;

export interface ZonedDateTimeOptionsValue {
  format?: DateTimeFormatPartsValue | undefined;
  placeName?: string | undefined;
  timeZone: string;
}

type MessageText<Key extends MessageKey> = ReferenceCatalogValue[Key] extends string
  ? ReferenceCatalogValue[Key]
  : Extract<ReferenceCatalogValue[Key][keyof ReferenceCatalogValue[Key]], string>;

type PlaceholderNames<Text extends string> = Text extends `${string}{${infer Name}}${infer Rest}`
  ? Name | PlaceholderNames<Rest>
  : never;

type PluralParamsValue<Names extends string> = { [Name in 'count' | Names]: Name extends 'count' ? number : number | string };

type ReferenceCatalogValue = typeof catalog;

type TextParamsValue<Names extends string> = Record<Names, number | string>;
