import {
  mkdirSync,
  mkdtempSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import {
  dirname,
  join,
} from 'node:path';

export interface TempWorkspaceValue {
  link: (relativeTarget: string, relativeLink: string) => void;
  remove: () => void;
  root: string;
  writeFile: (relativePath: string, content: string) => string;
  writePackage: (relativeDirectory: string, manifest: Readonly<Record<string, unknown>>, licenseText?: string) => string;
}

export const createTempWorkspace = (): TempWorkspaceValue => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'build-licenses-')));

  const writeFile = (relativePath: string, content: string): string => {
    const path = join(root, relativePath);

    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content);

    return path;
  };

  return {
    link: (relativeTarget, relativeLink): void => {
      const linkPath = join(root, relativeLink);

      mkdirSync(dirname(linkPath), { recursive: true });
      symlinkSync(join(root, relativeTarget), linkPath);
    },
    remove: (): void => {
      rmSync(root, { force: true, recursive: true });
    },
    root,
    writeFile,
    writePackage: (relativeDirectory, manifest, licenseText): string => {
      writeFile(join(relativeDirectory, 'package.json'), JSON.stringify(manifest));

      if (licenseText !== undefined) {
        writeFile(join(relativeDirectory, 'LICENSE'), licenseText);
      }

      return join(root, relativeDirectory);
    },
  };
};
