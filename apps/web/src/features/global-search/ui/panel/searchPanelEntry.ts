import type { LocaleCode } from '@/shared/i18n';

import { globalSearchSection } from '../../i18n/globalSearchSection';

export { SearchController } from './SearchController';

export const requestGlobalSearchTexts = (locale: LocaleCode): void => {
  globalSearchSection.request(locale);
};
