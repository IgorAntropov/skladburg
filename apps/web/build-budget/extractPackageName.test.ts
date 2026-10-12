import {
  describe,
  expect,
  it,
} from 'vitest';

import { extractPackageName } from './extractPackageName.ts';

describe('extractPackageName', () => {
  it('reads a plain package', () => {
    expect(extractPackageName('/repo/node_modules/react-dom/client.js')).toBe('react-dom');
  });

  it('reads a scoped package', () => {
    expect(extractPackageName('/repo/node_modules/@tanstack/query-core/build/modern/index.js')).toBe('@tanstack/query-core');
  });

  it('reads the package from the pnpm layout by the last node_modules segment', () => {
    expect(
      extractPackageName('/repo/node_modules/.pnpm/framer-motion@13.5.1_react@19.3.0/node_modules/framer-motion/dist/es/index.mjs'),
    ).toBe('framer-motion');
    expect(
      extractPackageName(
        '/repo/node_modules/.pnpm/@radix-ui+react-slot@1.4.0_react@19.3.0/node_modules/@radix-ui/react-slot/dist/index.mjs',
      ),
    ).toBe('@radix-ui/react-slot');
  });

  it('normalizes Windows separators', () => {
    expect(extractPackageName(String.raw`C:\repo\node_modules\.pnpm\three@0.180.0\node_modules\three\build\three.module.js`)).toBe('three');
    expect(extractPackageName(String.raw`C:\repo\node_modules\@react-three\fiber\dist\index.js`)).toBe('@react-three/fiber');
  });

  it('reads the package of a virtual module that wraps a real file', () => {
    expect(extractPackageName('\0/repo/node_modules/zustand/index.js?commonjs-es-import')).toBe('zustand');
  });

  it('ignores a query on a regular module', () => {
    expect(extractPackageName('/repo/node_modules/three/build/three.module.js?v=abc')).toBe('three');
  });

  it('returns nothing for application code and virtual modules without node_modules', () => {
    expect(extractPackageName('/repo/apps/web/src/app/App.tsx')).toBeUndefined();
    expect(extractPackageName('\0vite/preload-helper.js')).toBeUndefined();
    expect(extractPackageName('\0rolldown/runtime.js')).toBeUndefined();
  });

  it('returns nothing for a broken node_modules path', () => {
    expect(extractPackageName('/repo/node_modules/')).toBeUndefined();
    expect(extractPackageName('/repo/node_modules//index.js')).toBeUndefined();
    expect(extractPackageName('/repo/node_modules/@scope')).toBeUndefined();
    expect(extractPackageName('/repo/node_modules/@scope/')).toBeUndefined();
  });

  it('does not treat a folder named like node_modules as one', () => {
    expect(extractPackageName('/repo/my_node_modules/three/index.js')).toBeUndefined();
  });
});
