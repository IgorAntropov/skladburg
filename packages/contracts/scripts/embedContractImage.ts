import {
  fromBinary,
  toBinary,
} from '@bufbuild/protobuf';
import { FileDescriptorSetSchema } from '@bufbuild/protobuf/wkt';
import {
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';

import { renderContractImageModule } from './renderContractImageModule.ts';

const generatedDirectory = join(import.meta.dirname, '..', 'src', 'gen');

const image = readFileSync(join(generatedDirectory, 'contract_runtime.binpb'));

writeFileSync(join(generatedDirectory, 'contract_image.ts'), renderContractImageModule(image));
writeFileSync(join(generatedDirectory, 'contract_image_deflate.ts'), renderContractImageModule(deflateSync(image, { level: 9 })));

const validationImage = fromBinary(FileDescriptorSetSchema, image);
for (const file of validationImage.file) {
  file.service = [];
}
const validationBytes = toBinary(FileDescriptorSetSchema, validationImage);
writeFileSync(
  join(generatedDirectory, 'contract_validation_image_deflate.ts'),
  renderContractImageModule(deflateSync(validationBytes, { level: 9 })),
);
