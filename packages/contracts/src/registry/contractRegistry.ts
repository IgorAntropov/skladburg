import type {
  DescFile,
  DescMessage,
  FileRegistry,
} from '@bufbuild/protobuf';

import {
  create,
  createFileRegistry,
  fromBinary,
} from '@bufbuild/protobuf';
import { base64Decode } from '@bufbuild/protobuf/wire';
import {
  file_google_protobuf_descriptor,
  file_google_protobuf_duration,
  file_google_protobuf_field_mask,
  file_google_protobuf_timestamp,
  FileDescriptorSetSchema,
} from '@bufbuild/protobuf/wkt';
import { file_buf_validate_validate } from '@bufbuild/protovalidate/gen/buf/validate/validate_pb.js';

import { CONTRACT_IMAGE_BASE64 } from '../gen/contract_image';

const IMPORTED_FILES: readonly DescFile[] = [
  file_google_protobuf_descriptor,
  file_google_protobuf_duration,
  file_google_protobuf_field_mask,
  file_google_protobuf_timestamp,
  file_buf_validate_validate,
];

let cachedRegistry: FileRegistry | undefined;

const buildContractRegistry = (): FileRegistry => {
  const image = fromBinary(FileDescriptorSetSchema, base64Decode(CONTRACT_IMAGE_BASE64));

  return createFileRegistry(create(FileDescriptorSetSchema, {
    file: [...IMPORTED_FILES.map(file => file.proto), ...image.file],
  }));
};

export const getContractRegistry = (): FileRegistry => {
  cachedRegistry ??= buildContractRegistry();

  return cachedRegistry;
};

export const getRuleSchema = <TDesc extends DescMessage>(registry: FileRegistry, schema: TDesc): TDesc => {
  const ruleSchema = registry.getMessage(schema.typeName);

  if (ruleSchema === undefined) {
    throw new Error(`Message ${schema.typeName} is not described in the contract image`);
  }

  return ruleSchema as TDesc;
};
