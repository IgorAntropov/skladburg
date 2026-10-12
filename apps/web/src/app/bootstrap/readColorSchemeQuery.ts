import { DARK_COLOR_SCHEME_QUERY } from '@/shared/theme';

export const readColorSchemeQuery = (target: Partial<Pick<Window, 'matchMedia'>>): MediaQueryList | undefined => {
  return typeof target.matchMedia === 'function' ? target.matchMedia(DARK_COLOR_SCHEME_QUERY) : undefined;
};
