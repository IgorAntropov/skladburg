import type {
  DescFile,
  DescMethod,
  DescMethodUnary,
} from '@bufbuild/protobuf';

import {
  clone,
  create,
  createFileRegistry,
  setExtension,
} from '@bufbuild/protobuf';
import {
  FieldDescriptorProto_Label,
  FieldDescriptorProto_Type,
  FieldDescriptorProtoSchema,
  FileDescriptorProtoSchema,
  FileDescriptorSetSchema,
  MethodOptionsSchema,
} from '@bufbuild/protobuf/wkt';
import {
  access,
  type MethodAccess,
} from '@skladburg/contracts/common/v1/method_options';
import { MoneySchema } from '@skladburg/contracts/common/v1/money';
import { OrganizationService } from '@skladburg/contracts/organization/v1/organization';

const PROBE_METHOD_NAME = 'CreateWarehouse';
const PROBE_REQUEST_NAME = 'CreateWarehouseRequest';
const PROBE_AMOUNT_FIELD = create(FieldDescriptorProtoSchema, {
  jsonName: 'amount',
  label: FieldDescriptorProto_Label.OPTIONAL,
  name: 'amount',
  number: 100,
  type: FieldDescriptorProto_Type.MESSAGE,
  typeName: `.${MoneySchema.typeName}`,
});

const isUnaryMethod = (method: DescMethod): method is DescMethodUnary => method.methodKind === 'unary';

const collectFiles = (file: DescFile, collected: Map<string, DescFile>): void => {
  if (collected.has(file.name)) {
    return;
  }

  for (const dependency of file.dependencies) {
    collectFiles(dependency, collected);
  }

  collected.set(file.name, file);
};

export const createProbeMethod = (methodAccess: MethodAccess | undefined): DescMethodUnary => {
  const files = new Map<string, DescFile>();
  collectFiles(MoneySchema.file, files);
  collectFiles(OrganizationService.file, files);

  const protos = [...files.values()].map((file) => {
    const proto = clone(FileDescriptorProtoSchema, file.proto);

    for (const message of proto.messageType.filter(candidate => candidate.name === PROBE_REQUEST_NAME)) {
      message.field.push(clone(FieldDescriptorProtoSchema, PROBE_AMOUNT_FIELD));

      if (!proto.dependency.includes(MoneySchema.file.proto.name)) {
        proto.dependency.push(MoneySchema.file.proto.name);
      }
    }

    for (const service of proto.service) {
      for (const method of service.method.filter(candidate => candidate.name === PROBE_METHOD_NAME)) {
        method.options = create(MethodOptionsSchema);

        if (methodAccess !== undefined) {
          setExtension(method.options, access, methodAccess);
        }
      }
    }

    return proto;
  });

  const registry = createFileRegistry(create(FileDescriptorSetSchema, { file: protos }));
  const method = registry.getService(OrganizationService.typeName)?.methods.find(candidate => candidate.name === PROBE_METHOD_NAME);

  if (method === undefined || !isUnaryMethod(method)) {
    throw new Error('The probe method is not available in the rebuilt registry');
  }

  return method;
};

