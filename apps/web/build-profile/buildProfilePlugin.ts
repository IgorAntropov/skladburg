import type { Plugin } from 'vite';

import type { LoadBuildProfileOptionsValue } from './loadBuildProfile.ts';

import { applyProfileToHtml } from './applyProfileToHtml.ts';
import {
  RESOLVED_VIRTUAL_MODULE_ID,
  VIRTUAL_MODULE_ID,
} from './buildProfilePaths.ts';
import { createProfileModuleSource } from './createProfileModuleSource.ts';
import { loadBuildProfile } from './loadBuildProfile.ts';

export type BuildProfilePluginValue = Omit<Plugin, 'load' | 'resolveId' | 'transformIndexHtml'> & {
  load: (id: string) => string | undefined;
  resolveId: (id: string) => string | undefined;
  transformIndexHtml: { handler: (html: string) => string; order: 'pre' };
};

export const buildProfilePlugin = (options: LoadBuildProfileOptionsValue): BuildProfilePluginValue => {
  const profile = loadBuildProfile(options);
  const moduleSource = createProfileModuleSource(profile);

  return {
    load: id => (id === RESOLVED_VIRTUAL_MODULE_ID ? moduleSource : undefined),
    name: 'skladburg:build-profile',
    resolveId: id => (id === VIRTUAL_MODULE_ID ? RESOLVED_VIRTUAL_MODULE_ID : undefined),
    transformIndexHtml: {
      handler: html => applyProfileToHtml(html, profile),
      order: 'pre',
    },
  };
};
