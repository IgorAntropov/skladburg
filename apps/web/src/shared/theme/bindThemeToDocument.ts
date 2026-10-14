import type {
  IThemePreferenceStore,
  IThemeTransitions,
} from './themeTypes';

import { THEME_COLOR_BY_THEME } from './themeConstants';

const THEME_COLOR_META_SELECTOR = 'meta[name="theme-color"]';

const MOTION_ALLOWED_QUERY = '(prefers-reduced-motion: no-preference)';

export const createDocumentThemeTransitions = (): IThemeTransitions => ({
  isMotionAllowed: () => typeof window.matchMedia === 'function' && window.matchMedia(MOTION_ALLOWED_QUERY).matches,
  startViewTransition: typeof document.startViewTransition === 'function'
    ? (update) => {
        document.startViewTransition(update);
      }
    : undefined,
});

export const bindThemeToDocument = (
  store: IThemePreferenceStore,
  root: HTMLElement,
  transitions: IThemeTransitions = createDocumentThemeTransitions(),
): () => void => {
  const writeTheme = (): void => {
    const resolvedTheme = store.getResolvedTheme();

    root.dataset.theme = resolvedTheme;
    root.style.colorScheme = resolvedTheme;

    const themeColorMeta = root.ownerDocument.querySelector<HTMLMetaElement>(THEME_COLOR_META_SELECTOR);

    if (themeColorMeta !== null) {
      themeColorMeta.content = THEME_COLOR_BY_THEME[resolvedTheme];
    }
  };

  const applyTheme = (): void => {
    const { startViewTransition } = transitions;

    if (startViewTransition === undefined || !transitions.isMotionAllowed()) {
      writeTheme();

      return;
    }

    startViewTransition(writeTheme);
  };

  writeTheme();

  return store.subscribe(applyTheme);
};
