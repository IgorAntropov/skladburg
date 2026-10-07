import type { FileRegistry } from '@bufbuild/protobuf';

import {
  createFileRegistry,
  fromBinary,
} from '@bufbuild/protobuf';
import { FileDescriptorSetSchema } from '@bufbuild/protobuf/wkt';
import { readFileSync } from 'node:fs';

export const loadContractRegistry = (imagePath: string): FileRegistry =>
  createFileRegistry(fromBinary(FileDescriptorSetSchema, readFileSync(imagePath)));
