import type { CatalogTranslate } from '../localizer/localizationTypes';
import type {
  CatalogShapeValue,
  LocaleCode,
  PluralFormsValue,
} from '../localizer/messageShape';

export interface CatalogSectionOptionsValue<TCatalog extends CatalogShapeValue> {
  loaders: Readonly<Partial<Record<LocaleCode, () => Promise<SectionLocaleCatalogValue<TCatalog>>>>>;
  prefix: string;
}

export interface CatalogSectionResultValue<TCatalog extends CatalogShapeValue> {
  retry: () => void;
  status: SectionStatus;
  t: SectionTranslate<TCatalog> | undefined;
}

export interface CatalogSectionValue<TCatalog extends CatalogShapeValue> {
  readonly load: (locale: LocaleCode) => Promise<SectionLocaleCatalogValue<TCatalog>>;
  readonly locales: readonly LocaleCode[];
  readonly prefix: string;
  readonly read: (locale: LocaleCode) => SectionStateValue<TCatalog>;
  readonly request: (locale: LocaleCode) => void;
  readonly subscribe: (listener: () => void) => () => void;
}

export type SectionLocaleCatalogValue<TCatalog extends CatalogShapeValue> = {
  readonly [Key in keyof TCatalog]: TCatalog[Key] extends string ? string : PluralFormsValue;
};

export type SectionStateValue<TCatalog extends CatalogShapeValue>
  = | { catalog: SectionLocaleCatalogValue<TCatalog>; status: 'ready' }
    | { catalog: undefined; status: 'error' | 'loading' };

export type SectionStatus = 'error' | 'loading' | 'ready';

export type SectionTranslate<TCatalog extends CatalogShapeValue> = CatalogTranslate<TCatalog>;
