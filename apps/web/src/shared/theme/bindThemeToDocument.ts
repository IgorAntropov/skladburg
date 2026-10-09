import type {
  IThemePreferenceStore,
  IThemeTransitions,
} from './themeTypes';

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
