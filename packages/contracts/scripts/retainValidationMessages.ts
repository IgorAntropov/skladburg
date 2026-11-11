import type {
  DescriptorProto,
  FieldDescriptorProto,
  FileDescriptorSet,
} from '@bufbuild/protobuf/wkt';

const indexMessage = (
  name: string,
  message: DescriptorProto,
  root: DescriptorProto,
  owners: Map<string, DescriptorProto>,
): void => {
  owners.set(name, root);

  for (const nested of message.nestedType) {
    indexMessage(`${name}.${nested.name}`, nested, root, owners);
  }
};

export const retainValidationMessages = (image: FileDescriptorSet): void => {
  const owners = new Map<string, DescriptorProto>();
  const needed = new Set<DescriptorProto>();
  const pending = new Set<string>();

  const collectField = (field: FieldDescriptorProto): void => {
    if (field.typeName !== '') {
      pending.add(field.typeName);
    }
    if (field.extendee !== '') {
      pending.add(field.extendee);
    }
  };

  const collectMessage = (message: DescriptorProto): void => {
    message.field.forEach(collectField);
    message.extension.forEach(collectField);
    message.nestedType.forEach(collectMessage);
  };

  for (const file of image.file) {
    const prefix = file.package === '' ? '' : `.${file.package}`;

    for (const message of file.messageType) {
      indexMessage(`${prefix}.${message.name}`, message, message, owners);
    }
    for (const service of file.service) {
      for (const method of service.method) {
        pending.add(method.inputType);
      }
    }
    file.extension.forEach(collectField);
  }

  for (const name of pending) {
    const root = owners.get(name);

    if (root !== undefined && !needed.has(root)) {
      needed.add(root);
      collectMessage(root);
    }
  }

  for (const file of image.file) {
    file.messageType = file.messageType.filter(message => needed.has(message));
  }
};
