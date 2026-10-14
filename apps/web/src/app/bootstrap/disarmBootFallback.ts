import { BOOT_FALLBACK_ELEMENT_ID } from './bootFallbackConstants';

export const disarmBootFallback = (document: Pick<Document, 'getElementById'>): void => {
  document.getElementById(BOOT_FALLBACK_ELEMENT_ID)?.remove();
};
