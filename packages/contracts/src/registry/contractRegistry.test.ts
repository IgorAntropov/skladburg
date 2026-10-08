import type {
  DescFile,
  DescMessage,
  DescMethod,
  Message,
} from '@bufbuild/protobuf';
import type {
  GenExtension,
  GenMessage,
} from '@bufbuild/protobuf/codegenv2';
import type {
  DescriptorProto,
  FieldOptions,
  MessageOptions,
  OneofOptions,
} from '@bufbuild/protobuf/wkt';

import {
  clearExtension,
  clone,
  create,
  createFileRegistry,
  fromBinary,
  getOption,
  hasOption,
  toBinary,
} from '@bufbuild/protobuf';
import { base64Decode } from '@bufbuild/protobuf/wire';
import {
  FieldOptionsSchema,
  FileDescriptorProtoSchema,
  FileDescriptorSetSchema,
  MessageOptionsSchema,
  OneofOptionsSchema,
} from '@bufbuild/protobuf/wkt';
import {
  field as fieldRules,
  file_buf_validate_validate,
  message as messageRules,
  oneof as oneofRules,
} from '@bufbuild/protovalidate/gen/buf/validate/validate_pb.js';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  describe,
  expect,
  it,
} from 'vitest';

import { CONTRACT_IMAGE_BASE64 } from '../gen/contract_image';
import {
  CreateWarehouseRequestSchema,
  file_organization_v1_organization,
} from '../gen/organization/v1/organization_pb';
import {
  getContractRegistry,
  getRuleSchema,
} from './contractRegistry';

const GENERATED_DIRECTORY = join(import.meta.dirname, '..', 'gen');
const VALIDATE_FILE_NAME = 'buf/validate/validate.proto';
const EXTERNAL_FILE_PREFIXES: readonly string[] = ['buf/validate/', 'google/'];
const MESSAGES_WITH_RULES: readonly string[] = [
  'common.v1.MethodAccess',
  'common.v1.Money',
  'common.v1.PageRequest',
  'common.v1.PermissionRequirement',
  'organization.v1.CreateWarehouseRequest',
  'organization.v1.GetOrganizationRequest',
];

const registry = getContractRegistry();

const isFileDescriptor = (candidate: unknown): candidate is DescFile =>
  typeof candidate === 'object' && candidate !== null && 'proto' in candidate && 'messages' in candidate;

const isExternalFile = (file: DescFile): boolean =>
  EXTERNAL_FILE_PREFIXES.some(prefix => file.name.startsWith(prefix));

const loadModuleExports = async (modulePath: string): Promise<unknown[]> => {
  const loaded: unknown = await import(join(GENERATED_DIRECTORY, modulePath));

  if (typeof loaded !== 'object' || loaded === null) {
    return [];
  }

  const exportedValues: unknown[] = Object.values(loaded);

  return exportedValues;
};

const loadGeneratedFiles = async (): Promise<DescFile[]> => {
  const modulePaths = readdirSync(GENERATED_DIRECTORY, { recursive: true })
    .filter((entry): entry is string => typeof entry === 'string' && entry.endsWith('_pb.ts'));
  const exportGroups = await Promise.all(modulePaths.map(loadModuleExports));

  return exportGroups.flat().filter(isFileDescriptor);
};

const generatedFiles = await loadGeneratedFiles();
const contractFiles = generatedFiles.filter(file => !isExternalFile(file));

const listMessages = (messages: readonly DescMessage[]): DescMessage[] =>
  messages.flatMap(current => [current, ...listMessages(current.nestedMessages)]);

const listMethodTypes = (method: DescMethod): DescMessage[] => [method.input, method.output];

const hasRules = (current: DescMessage): boolean =>
  hasOption(current, messageRules)
  || current.fields.some(candidate => hasOption(candidate, fieldRules))
  || current.oneofs.some(candidate => hasOption(candidate, oneofRules));

const withoutRules = <TOptions extends Message>(
  options: TOptions | undefined,
  schema: GenMessage<TOptions>,
  extension: GenExtension<TOptions>,
): TOptions | undefined => {
  if (options === undefined) {
    return undefined;
  }

  clearExtension(options, extension);

  return toBinary(schema, options).length === 0 ? undefined : options;
};

const stripMessageRules = (proto: DescriptorProto): void => {
  proto.options = withoutRules<MessageOptions>(proto.options, MessageOptionsSchema, messageRules);
  proto.field.forEach((candidate) => {
    candidate.options = withoutRules<FieldOptions>(candidate.options, FieldOptionsSchema, fieldRules);
  });
  proto.oneofDecl.forEach((candidate) => {
    candidate.options = withoutRules<OneofOptions>(candidate.options, OneofOptionsSchema, oneofRules);
  });
  proto.nestedType.forEach(stripMessageRules);
};

describe('contract registry', () => {
  it('finds every message of every generated file', () => {
    const missing = generatedFiles
      .flatMap(file => listMessages(file.messages))
      .filter(current => registry.getMessage(current.typeName) === undefined)
      .map(current => current.typeName);

    expect(contractFiles.length).toBeGreaterThan(0);
    expect(missing).toEqual([]);
  });

  it('finds the input and output of every method of every service', () => {
    const services = generatedFiles.flatMap(file => file.services);
    const missing = services
      .flatMap(service => service.methods)
      .flatMap(listMethodTypes)
      .filter(current => registry.getMessage(current.typeName) === undefined)
      .map(current => current.typeName);

    expect(services.length).toBeGreaterThan(0);
    expect(missing).toEqual([]);
  });

  it('carries rules for the messages that declare them', () => {
    const typeNamesWithRules = [...registry.files]
      .filter(file => !isExternalFile(file))
      .flatMap(file => listMessages(file.messages))
      .filter(hasRules)
      .map(current => current.typeName);

    expect(typeNamesWithRules).toEqual(expect.arrayContaining([...MESSAGES_WITH_RULES]));
  });

  it('differs from the generated descriptors only by the validation rules', () => {
    contractFiles.forEach((file) => {
      const imageFile = registry.getFile(file.proto.name);

      expect(imageFile, file.name).toBeDefined();

      if (imageFile === undefined) {
        return;
      }

      const stripped = clone(FileDescriptorProtoSchema, imageFile.proto);
      stripped.$unknown = undefined;
      stripped.dependency = stripped.dependency.filter(name => name !== VALIDATE_FILE_NAME);
      stripped.messageType.forEach(stripMessageRules);

      expect(stripped.dependency, file.name).toEqual(file.proto.dependency);
      expect(
        toBinary(FileDescriptorProtoSchema, stripped),
        file.name,
      ).toEqual(toBinary(FileDescriptorProtoSchema, file.proto));
    });
  });

  it('keeps the min_len rule of the warehouse name in the image only', () => {
    const imageName = getRuleSchema(registry, CreateWarehouseRequestSchema).fields.find(candidate => candidate.name === 'name');
    const generatedName = CreateWarehouseRequestSchema.fields.find(candidate => candidate.name === 'name');

    expect(imageName).toBeDefined();
    expect(generatedName).toBeDefined();

    if (imageName === undefined || generatedName === undefined) {
      return;
    }

    const imageRules = getOption(imageName, fieldRules);

    expect(imageRules.type.case).toBe('string');
    expect(imageRules.type.case === 'string' ? imageRules.type.value.minLen : undefined).toBe(1n);
    expect(hasOption(generatedName, fieldRules)).toBe(false);
  });

  it('does not make the generated files depend on the validation descriptor', () => {
    const dependentFiles = generatedFiles
      .filter(file => file.dependencies.some(dependency => dependency.name === VALIDATE_FILE_NAME))
      .map(file => file.name);

    expect(dependentFiles).toEqual([]);
    expect(file_organization_v1_organization.dependencies.map(dependency => dependency.name)).not.toContain(VALIDATE_FILE_NAME);
  });

  it('keeps external files out of the embedded image', () => {
    const image = fromBinary(FileDescriptorSetSchema, base64Decode(CONTRACT_IMAGE_BASE64));
    const externalNames = image.file.map(file => file.name).filter(name => EXTERNAL_FILE_PREFIXES.some(prefix => name.startsWith(prefix)));

    expect(image.file.length).toBeGreaterThan(0);
    expect(externalNames).toEqual([]);
  });

  it('serves the validation descriptor shipped with the validator', () => {
    const validateFile = registry.getFile(VALIDATE_FILE_NAME);

    expect(validateFile).toBeDefined();
    expect(validateFile?.proto).toBe(file_buf_validate_validate.proto);
  });

  it('returns the same registry on every call', () => {
    expect(getContractRegistry()).toBe(registry);
  });
});

describe('getRuleSchema', () => {
  it('returns the description of the same message from the image', () => {
    const ruleSchema = getRuleSchema(registry, CreateWarehouseRequestSchema);

    expect(ruleSchema.typeName).toBe(CreateWarehouseRequestSchema.typeName);
    expect(ruleSchema).not.toBe(CreateWarehouseRequestSchema);
  });

  it('throws with the type name for a message missing from the registry', () => {
    const emptyRegistry = createFileRegistry(create(FileDescriptorSetSchema));

    expect(() => getRuleSchema(emptyRegistry, CreateWarehouseRequestSchema)).toThrow('organization.v1.CreateWarehouseRequest');
  });
});
