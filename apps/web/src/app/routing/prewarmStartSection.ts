import type { AppSectionValue } from '@/shared/routing';

import {
  APP_SECTIONS,
  getAddressSection,
  parseAddressPath,
} from '@/shared/routing';

import type { SectionLoadersValue } from './sectionPages';

export interface PrewarmStartSectionOptionsValue {
  loaders: SectionLoadersValue;
  path: string;
}

export const findStartSection = (path: string): AppSectionValue | undefined => {
  const address = parseAddressPath(path);

  if (address === undefined) {
    return undefined;
  }

  return getAddressSection(address) ?? APP_SECTIONS[0];
};

export const prewarmStartSection = ({ loaders, path }: PrewarmStartSectionOptionsValue): void => {
  const section = findStartSection(path);

  if (section === undefined) {
    return;
  }

  new Promise<unknown>((resolve) => {
    resolve(loaders[section]());
  }).catch((error: unknown) => {
    console.error('> mountApp -> prewarmStartSection:', { error, section });
  });
};
