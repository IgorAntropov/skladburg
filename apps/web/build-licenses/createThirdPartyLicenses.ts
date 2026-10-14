import type { Plugin } from 'vite';

import type {
  ThirdPartyLicensesOptionsValue,
  ThirdPartyLicensesValue,
} from './licenseTypes.ts';

import { addChunkModuleIds } from './collectChunkModuleIds.ts';
import { collectThirdPartyLicenses } from './collectThirdPartyLicenses.ts';
import {
  FALLBACK_LICENSE_TEXTS,
  FALLBACK_LICENSE_TEXTS_DIRECTORY,
} from './fallbackLicenseTexts.ts';
import { formatThirdPartyLicenses } from './formatThirdPartyLicenses.ts';

export const createThirdPartyLicenses = ({
  allowedLicenses,
  appRoot,
  extraPackages,
  fallbackDirectory = FALLBACK_LICENSE_TEXTS_DIRECTORY,
  fallbackTexts = FALLBACK_LICENSE_TEXTS,
  fileName,
}: ThirdPartyLicensesOptionsValue): ThirdPartyLicensesValue => {
  const workerModuleIds = new Set<string>();

  const plugin: Plugin = {
    apply: 'build',
    generateBundle(_options, bundle) {
      const moduleIds = new Set(workerModuleIds);

      addChunkModuleIds(bundle, moduleIds);

      const { licenses, violations } = collectThirdPartyLicenses({
        allowedLicenses,
        appRoot,
        extraPackages,
        fallbackDirectory,
        fallbackTexts,
        moduleIds,
      });

      if (violations.length > 0) {
        this.error(violations.join('\n'));
      }

      this.emitFile({ fileName, source: formatThirdPartyLicenses(licenses), type: 'asset' });

      console.log('> createThirdPartyLicenses -> generateBundle:', { fileName, packages: licenses.length });
    },
    name: 'skladburg:third-party-licenses',
  };

  const workerPlugin = (): Plugin => ({
    generateBundle(_options, bundle) {
      addChunkModuleIds(bundle, workerModuleIds);
    },
    name: 'skladburg:third-party-licenses-worker',
  });

  return { plugin, workerPlugin };
};
