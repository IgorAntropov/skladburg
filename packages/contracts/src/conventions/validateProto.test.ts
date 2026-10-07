import type {
  DescriptorProto,
  EnumDescriptorProto,
  FieldDescriptorProto,
  FileDescriptorProto,
} from '@bufbuild/protobuf/wkt';

import { clone } from '@bufbuild/protobuf';
import { FileDescriptorProtoSchema } from '@bufbuild/protobuf/wkt';
import { file_buf_validate_validate as bundledValidateFile } from '@bufbuild/protovalidate/gen/buf/validate/validate_pb.js';
import {
  describe,
  expect,
  it,
} from 'vitest';

import { loadContractRegistry } from './loadContractRegistry';
import { contractImagePath } from './syntheticContract';

const VALIDATE_FILE_NAME = 'buf/validate/validate.proto';

const describeField = (scope: string, field: FieldDescriptorProto): string =>
  [
    `field ${scope}.${field.name}`,
    `number=${String(field.number)}`,
    `type=${String(field.type)}`,
    `typeName=${field.typeName}`,
    `label=${String(field.label)}`,
    `extendee=${field.extendee}`,
  ].join(' ');

const describeEnum = (scope: string, enumType: EnumDescriptorProto): string[] => [
  `enum ${scope}.${enumType.name}`,
  ...enumType.value.map(value => `enum value ${scope}.${enumType.name}.${value.name}=${String(value.number)}`),
];

const describeMessage = (scope: string, message: DescriptorProto): string[] => {
  const name = `${scope}.${message.name}`;

  return [
    `message ${name}`,
    ...message.field.map(field => describeField(name, field)),
    ...message.extension.map(extension => describeField(name, extension)),
    ...message.oneofDecl.map(oneof => `oneof ${name}.${oneof.name}`),
    ...message.enumType.flatMap(enumType => describeEnum(name, enumType)),
    ...message.nestedType.flatMap(nested => describeMessage(name, nested)),
  ];
};

const describeFile = (file: FileDescriptorProto): string[] =>
  [
    `package ${file.package}`,
    ...file.dependency.map(dependency => `dependency ${dependency}`),
    ...file.messageType.flatMap(message => describeMessage(file.package, message)),
    ...file.enumType.flatMap(enumType => describeEnum(file.package, enumType)),
    ...file.extension.map(extension => describeField(file.package, extension)),
  ].sort();

const readImageValidateFile = (): FileDescriptorProto => {
  const file = loadContractRegistry(contractImagePath).getFile(VALIDATE_FILE_NAME);

  if (!file) {
    throw new Error(`Contract image does not include ${VALIDATE_FILE_NAME}`);
  }

  return file.proto;
};

describe('buf.validate descriptor', () => {
  it('matches the bundled protovalidate descriptor in messages, fields, enums and extensions', () => {
    expect(describeFile(readImageValidateFile())).toEqual(describeFile(bundledValidateFile.proto));
  });

  it('describes the field extension with its number', () => {
    const description = describeFile(readImageValidateFile());

    expect(description.some(line => line.startsWith('field buf.validate.field number=1159 '))).toBe(true);
    expect(description).toContain('message buf.validate.FieldRules');
  });

  it('detects a changed field number', () => {
    const changed = clone(FileDescriptorProtoSchema, readImageValidateFile());
    const rules = changed.messageType.find(message => message.name === 'FieldRules');
    const firstField = rules?.field[0];

    if (firstField) {
      firstField.number += 1000;
    }

    expect(describeFile(changed)).not.toEqual(describeFile(bundledValidateFile.proto));
  });

  it('detects a removed message', () => {
    const changed = clone(FileDescriptorProtoSchema, readImageValidateFile());

    changed.messageType = changed.messageType.filter(message => message.name !== 'Violation');

    expect(describeFile(changed)).not.toEqual(describeFile(bundledValidateFile.proto));
  });
});
