import type {
  DescriptorProto,
  FieldDescriptorProto,
  FileDescriptorSet,
} from '@bufbuild/protobuf/wkt';

const defaultJsonName = (name: string): string =>
  name.replace(/_([a-z])/gu, (_match, letter: string) => letter.toUpperCase());

const visitMessageFields = (message: DescriptorProto, visit: (field: FieldDescriptorProto) => void): void => {
  message.field.forEach(visit);
  for (const nested of message.nestedType) {
    visitMessageFields(nested, visit);
  }
};

const visitFields = (image: FileDescriptorSet, visit: (field: FieldDescriptorProto) => void): void => {
  for (const file of image.file) {
    for (const message of file.messageType) {
      visitMessageFields(message, visit);
    }
  }
};

export const compactValidationImage = (image: FileDescriptorSet): void => {
  for (const file of image.file) {
    file.service = [];
  }
  visitFields(image, (field) => {
    if (field.jsonName === defaultJsonName(field.name)) {
      Reflect.deleteProperty(field, 'jsonName');
    }
  });
};

export const restoreValidationImage = (image: FileDescriptorSet): void => {
  visitFields(image, (field) => {
    if (field.jsonName === '') {
      field.jsonName = defaultJsonName(field.name);
    }
  });
};
