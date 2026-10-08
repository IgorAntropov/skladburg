import type { IThemePreferenceStore } from './themeTypes';

export const bindThemeToDocument = (store: IThemePreferenceStore, root: HTMLElement): () => void => {
  const applyTheme = (): void => {
    const resolvedTheme = store.getResolvedTheme();

    root.dataset.theme = resolvedTheme;
    root.style.colorScheme = resolvedTheme;
  };

  applyTheme();

  return store.subscribe(applyTheme);
};
