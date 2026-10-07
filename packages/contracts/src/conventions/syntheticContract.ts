import type {
  DescFile,
  FileRegistry,
} from '@bufbuild/protobuf';

import {
  clone,
  create,
  createFileRegistry,
  setExtension,
} from '@bufbuild/protobuf';
import {
  DescriptorProtoSchema,
  type FieldDescriptorProto,
  FieldDescriptorProto_Label,
  FieldDescriptorProto_Type,
  FieldDescriptorProtoSchema,
  FieldOptionsSchema,
  type FileDescriptorProto,
  FileDescriptorProtoSchema,
  FileDescriptorSetSchema,
  type MethodDescriptorProto,
  MethodDescriptorProtoSchema,
  type MethodOptions_IdempotencyLevel,
  MethodOptionsSchema,
  ServiceDescriptorProtoSchema,
} from '@bufbuild/protobuf/wkt';
import {
  field as fieldRules,
  FieldRulesSchema,
  StringRulesSchema,
} from '@bufbuild/protovalidate/gen/buf/validate/validate_pb.js';
import { fileURLToPath } from 'node:url';

import {
  access,
  type MethodAccess,
} from '../gen/common/v1/method_options_pb';
import { loadContractRegistry } from './loadContractRegistry';

const BASE_PACKAGES: readonly string[] = ['buf.validate', 'common.v1', 'google.protobuf'];
const SYNTHETIC_DEPENDENCIES: string[] = [
  'buf/validate/validate.proto',
  'common/v1/method_options.proto',
  'common/v1/money.proto',
  'common/v1/page.proto',
];

export const contractImagePath: string = fileURLToPath(new URL('../gen/contract.binpb', import.meta.url));

export interface SyntheticFileValue {
  methods: SyntheticMethodValue[];
  packageName: string;
}

export interface SyntheticMethodValue {
  access: MethodAccess | undefined;
  idempotency: MethodOptions_IdempotencyLevel;
  name: string;
  requestFields: FieldDescriptorProto[];
  responseFields: FieldDescriptorProto[];
}

const isBaseFile = (file: DescFile): boolean => BASE_PACKAGES.includes(file.proto.package);

const loadBaseFiles = (): FileDescriptorProto[] =>
  [...loadContractRegistry(contractImagePath).files]
    .filter(isBaseFile)
    .map(file => clone(FileDescriptorProtoSchema, file.proto));

const createRegistryFromFiles = (files: FileDescriptorProto[]): FileRegistry =>
  createFileRegistry(create(FileDescriptorSetSchema, { file: files }));

export const createScalarField = (
  name: string,
  number: number,
  type: FieldDescriptorProto_Type = FieldDescriptorProto_Type.STRING,
): FieldDescriptorProto =>
  create(FieldDescriptorProtoSchema, {
    label: FieldDescriptorProto_Label.OPTIONAL,
    name,
    number,
    type,
  });

export const createMessageField = (name: string, number: number, typeName: string): FieldDescriptorProto =>
  create(FieldDescriptorProtoSchema, {
    label: FieldDescriptorProto_Label.OPTIONAL,
    name,
    number,
    type: FieldDescriptorProto_Type.MESSAGE,
    typeName: `.${typeName}`,
  });

export const createUuidField = (name: string, number: number): FieldDescriptorProto => {
  const options = create(FieldOptionsSchema);

  setExtension(
    options,
    fieldRules,
    create(FieldRulesSchema, {
      type: {
        case: 'string',
        value: create(StringRulesSchema, { wellKnown: { case: 'uuid', value: true } }),
      },
    }),
  );

  return create(FieldDescriptorProtoSchema, {
    label: FieldDescriptorProto_Label.OPTIONAL,
    name,
    number,
    options,
    type: FieldDescriptorProto_Type.STRING,
  });
};

const createMethodProto = (packageName: string, method: SyntheticMethodValue): MethodDescriptorProto => {
  const options = create(MethodOptionsSchema, { idempotencyLevel: method.idempotency });

  if (method.access) {
    setExtension(options, access, method.access);
  }

  return create(MethodDescriptorProtoSchema, {
    inputType: `.${packageName}.${method.name}Request`,
    name: method.name,
    options,
    outputType: `.${packageName}.${method.name}Response`,
  });
};

const createSyntheticFile = (file: SyntheticFileValue): FileDescriptorProto =>
  create(FileDescriptorProtoSchema, {
    dependency: SYNTHETIC_DEPENDENCIES,
    messageType: file.methods.flatMap(method => [
      create(DescriptorProtoSchema, { field: method.requestFields, name: `${method.name}Request` }),
      create(DescriptorProtoSchema, { field: method.responseFields, name: `${method.name}Response` }),
    ]),
    name: 'probe/v1/probe.proto',
    package: file.packageName,
    service: [
      create(ServiceDescriptorProtoSchema, {
        method: file.methods.map(method => createMethodProto(file.packageName, method)),
        name: 'ProbeService',
      }),
    ],
    syntax: 'proto3',
  });

export const createSyntheticRegistry = (file: SyntheticFileValue): FileRegistry =>
  createRegistryFromFiles([...loadBaseFiles(), createSyntheticFile(file)]);

export const createRegistryWithModifiedFile = (
  fileName: string,
  modify: (file: FileDescriptorProto) => void,
): FileRegistry => {
  const files = loadBaseFiles();
  const target = files.find(file => file.name === fileName);

  if (!target) {
    throw new Error(`Base contract does not include ${fileName}`);
  }

  modify(target);

  return createRegistryFromFiles(files);
};
