import { join } from 'node:path';

import type { FallbackLicenseTextValue } from './licenseTypes.ts';

export const FALLBACK_LICENSE_TEXTS_DIRECTORY = join(import.meta.dirname, 'fallback-texts');

export const FALLBACK_LICENSE_TEXTS: readonly FallbackLicenseTextValue[] = [
  { files: ['bufbuild-cel-spec.LICENSE.txt'], license: 'Apache-2.0', name: '@bufbuild/cel-spec' },
  { files: ['bufbuild-cel.LICENSE.txt'], license: 'Apache-2.0', name: '@bufbuild/cel' },
  {
    files: ['bufbuild-protobuf.Apache-2.0.LICENSE.txt', 'bufbuild-protobuf.BSD-3-Clause.LICENSE.txt'],
    license: '(Apache-2.0 AND BSD-3-Clause)',
    name: '@bufbuild/protobuf',
  },
  { files: ['bufbuild-protovalidate.LICENSE.txt'], license: 'Apache-2.0', name: '@bufbuild/protovalidate' },
  { files: ['connectrpc-connect-web.LICENSE.txt'], license: 'Apache-2.0', name: '@connectrpc/connect-web' },
  { files: ['connectrpc-connect.LICENSE.txt'], license: 'Apache-2.0', name: '@connectrpc/connect' },
  { files: ['react-remove-scroll-bar.LICENSE.txt'], license: 'MIT', name: 'react-remove-scroll-bar' },
  { files: ['react-three-fiber.LICENSE.txt'], license: 'MIT', name: '@react-three/fiber' },
];
