import type { Plugin } from 'vite';

import {
  RESOLVED_VIRTUAL_MODULE_ID,
  VIRTUAL_MODULE_ID,
} from './appVersionPaths.ts';
import { createAppVersionModuleSource } from './createAppVersionModuleSource.ts';

export interface AppVersionPluginOptionsValue {
  appVersion: string;
}

export type AppVersionPluginValue = Omit<Plugin, 'load' | 'resolveId'> & {
  load: (id: string) => string | undefined;
  resolveId: (id: string) => string | undefined;
};

export const appVersionPlugin = ({ appVersion }: AppVersionPluginOptionsValue): AppVersionPluginValue => {
  const moduleSource = createAppVersionModuleSource(appVersion);

  return {
    load: id => (id === RESOLVED_VIRTUAL_MODULE_ID ? moduleSource : undefined),
    name: 'skladburg:app-version',
    resolveId: id => (id === VIRTUAL_MODULE_ID ? RESOLVED_VIRTUAL_MODULE_ID : undefined),
  };
};
