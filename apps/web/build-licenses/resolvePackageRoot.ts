import {
  existsSync,
  realpathSync,
} from 'node:fs';
import {
  basename,
  dirname,
  join,
} from 'node:path';

import type { ExtraLicensePackageValue } from './licenseTypes.ts';

const NODE_MODULES_DIRECTORY = 'node_modules';

const MANIFEST_FILE_NAME = 'package.json';

const findInstalledPackageRoot = (fromDirectory: string, name: string): string | undefined => {
  let directory = fromDirectory;

  for (;;) {
    const modulesDirectory = basename(directory) === NODE_MODULES_DIRECTORY ? directory : join(directory, NODE_MODULES_DIRECTORY);
    const candidate = join(modulesDirectory, name);

    if (existsSync(join(candidate, MANIFEST_FILE_NAME))) {
      return realpathSync(candidate);
    }

    const parent = dirname(directory);

    if (parent === directory) {
      return undefined;
    }

    directory = parent;
  }
};

export const resolvePackageRoot = (appRoot: string, extraPackage: ExtraLicensePackageValue): string | undefined =>
  [...extraPackage.resolveFrom, extraPackage.name].reduce<string | undefined>(
    (directory, name) => directory === undefined ? undefined : findInstalledPackageRoot(directory, name),
    appRoot,
  );
