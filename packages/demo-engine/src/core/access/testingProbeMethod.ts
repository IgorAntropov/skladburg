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
  FileDescriptorProtoSchema,
  FileDescriptorSetSchema,
  MethodOptionsSchema,
} from '@bufbuild/protobuf/wkt';
import {
  access,
  type MethodAccess,
} from '@skladburg/contracts/common/v1/method_options';
import { OrganizationService } from '@skladburg/contracts/organization/v1/organization';

const PROBE_METHOD_NAME = 'CreateWarehouse';

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
  collectFiles(OrganizationService.file, files);

  const protos = [...files.values()].map((file) => {
    const proto = clone(FileDescriptorProtoSchema, file.proto);

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

