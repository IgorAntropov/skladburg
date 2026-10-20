import type {
  DescFile,
  DescMessage,
  MessageInitShape,
} from '@bufbuild/protobuf';

import {
  create,
  createFileRegistry,
  fromBinary,
  getOption,
  hasOption,
  setExtension,
} from '@bufbuild/protobuf';
import {
  DescriptorProtoSchema,
  EnumDescriptorProtoSchema,
  FieldDescriptorProto_Label,
  FieldDescriptorProto_Type,
  FieldDescriptorProtoSchema,
  FieldOptionsSchema,
  file_google_protobuf_descriptor,
  file_google_protobuf_duration,
  file_google_protobuf_field_mask,
  file_google_protobuf_timestamp,
  FileDescriptorProtoSchema,
  FileDescriptorSetSchema,
  MessageOptionsSchema,
  OneofDescriptorProtoSchema,
  OneofOptionsSchema,
} from '@bufbuild/protobuf/wkt';
import {
  field as fieldRulesExtension,
  FieldRulesSchema,
  file_buf_validate_validate,
  Ignore,
  Int32RulesSchema,
  KnownRegex,
  message as messageRulesExtension,
  MessageRulesSchema,
  oneof as oneofRulesExtension,
  OneofRulesSchema,
  StringRulesSchema,
} from '@bufbuild/protovalidate/gen/buf/validate/validate_pb.js';
import {
  describe,
  expect,
  it,
} from 'vitest';

import { loadContractRegistry } from '../src/conventions/loadContractRegistry';
import { isPortableRegexPattern } from './isPortableRegexPattern';
import {
  readFileFormRules,
  readMessageFormRules,
} from './readFormRules';

type FieldRulesInit = MessageInitShape<typeof FieldRulesSchema>;
interface FieldSpec {
  isProto3Optional?: boolean;
  isRepeated?: boolean;
  name: string;
  number: number;
  oneofIndex?: number;
  rules?: FieldRulesInit;
  type: ProtoType;
  typeName?: string;
}

interface MessageSpec {
  fields: FieldSpec[];
  isMapEntry?: boolean;
  messageRules?: MessageInitShape<typeof MessageRulesSchema>;
  name: string;
  nested?: MessageSpec[];
  oneofs?: { name: string; rules?: MessageInitShape<typeof OneofRulesSchema> }[];
}

type ProtoType = FieldDescriptorProto_Type;

const STRING = FieldDescriptorProto_Type.STRING;
const INT32 = FieldDescriptorProto_Type.INT32;
const INT64 = FieldDescriptorProto_Type.INT64;
const UINT32 = FieldDescriptorProto_Type.UINT32;
const SINT64 = FieldDescriptorProto_Type.SINT64;
const ENUM = FieldDescriptorProto_Type.ENUM;
const MESSAGE = FieldDescriptorProto_Type.MESSAGE;
const BOOL = FieldDescriptorProto_Type.BOOL;
const DOUBLE = FieldDescriptorProto_Type.DOUBLE;
const BYTES = FieldDescriptorProto_Type.BYTES;

const createFieldProto = (spec: FieldSpec): ReturnType<typeof create<typeof FieldDescriptorProtoSchema>> => {
  const options = create(FieldOptionsSchema);

  if (spec.rules !== undefined) {
    setExtension(options, fieldRulesExtension, create(FieldRulesSchema, spec.rules));
  }

  return create(FieldDescriptorProtoSchema, {
    label: spec.isRepeated === true ? FieldDescriptorProto_Label.REPEATED : FieldDescriptorProto_Label.OPTIONAL,
    name: spec.name,
    number: spec.number,
    oneofIndex: spec.oneofIndex,
    options,
    proto3Optional: spec.isProto3Optional,
    type: spec.type,
    typeName: spec.typeName,
  });
};

const createMessageProto = (spec: MessageSpec): ReturnType<typeof create<typeof DescriptorProtoSchema>> => {
  const options = create(MessageOptionsSchema, { mapEntry: spec.isMapEntry });

  if (spec.messageRules !== undefined) {
    setExtension(options, messageRulesExtension, create(MessageRulesSchema, spec.messageRules));
  }

  const syntheticOneofs = spec.fields
    .filter(field => field.isProto3Optional === true)
    .map(field => create(OneofDescriptorProtoSchema, { name: `_${field.name}` }));

  const declaredOneofs = (spec.oneofs ?? []).map((oneof) => {
    const oneofOptions = create(OneofOptionsSchema);

    if (oneof.rules !== undefined) {
      setExtension(oneofOptions, oneofRulesExtension, create(OneofRulesSchema, oneof.rules));
    }

    return create(OneofDescriptorProtoSchema, { name: oneof.name, options: oneofOptions });
  });

  const fields = spec.fields.map((field) => {
    if (field.isProto3Optional !== true) {
      return createFieldProto(field);
    }

    return createFieldProto({
      ...field,
      oneofIndex: declaredOneofs.length + syntheticOneofs.findIndex(oneof => oneof.name === `_${field.name}`),
    });
  });

  return create(DescriptorProtoSchema, {
    field: fields,
    name: spec.name,
    nestedType: (spec.nested ?? []).map(createMessageProto),
    oneofDecl: [...declaredOneofs, ...syntheticOneofs],
    options,
  });
};

const createProbeFile = (messages: MessageSpec[]): DescFile => {
  const registry = createFileRegistry(create(FileDescriptorSetSchema, {
    file: [
      file_google_protobuf_descriptor.proto,
      file_google_protobuf_duration.proto,
      file_google_protobuf_field_mask.proto,
      file_google_protobuf_timestamp.proto,
      file_buf_validate_validate.proto,
      create(FileDescriptorProtoSchema, {
        dependency: ['buf/validate/validate.proto'],
        enumType: [
          create(EnumDescriptorProtoSchema, {
            name: 'Mode',
            value: [
              { name: 'MODE_UNSPECIFIED', number: 0 },
              { name: 'MODE_FAST', number: 1 },
              { name: 'MODE_SLOW', number: 2 },
              { name: 'MODE_FAST_ALIAS', number: 1 },
            ],
          }),
        ],
        messageType: [...messages, { fields: [], name: 'Leaf' }].map(createMessageProto),
        name: 'probe/v1/probe.proto',
        package: 'probe.v1',
        syntax: 'proto3',
      }),
    ],
  }));

  const file = registry.getFile('probe/v1/probe.proto');

  if (file === undefined) {
    throw new Error('Probe file is not registered');
  }

  return file;
};

const readProbeRules = (fields: FieldSpec[], extras: Partial<MessageSpec> = {}): ReturnType<typeof readMessageFormRules> => {
  const file = createProbeFile([{ fields, name: 'Probe', ...extras }]);
  const message: DescMessage | undefined = file.messages[0];

  if (message === undefined) {
    throw new Error('Probe message is missing');
  }

  return readMessageFormRules(message);
};

const readSingleField = (field: Omit<FieldSpec, 'name' | 'number'>): unknown =>
  readProbeRules([{ ...field, name: 'sample_value', number: 1 }])?.fields.sampleValue;

const stringRules = (rules: MessageInitShape<typeof StringRulesSchema>): FieldRulesInit => ({
  type: { case: 'string', value: rules },
});

describe('readMessageFormRules strings', () => {
  it('reads every supported string rule', () => {
    expect(readSingleField({
      rules: stringRules({
        contains: 'a',
        len: 5n,
        maxLen: 10n,
        minLen: 2n,
        notContains: 'b',
        pattern: '^[a-z]+$',
        prefix: 'p',
        suffix: 's',
      }),
      type: STRING,
    })).toEqual({
      contains: 'a',
      kind: 'string',
      len: 5,
      maxLen: 10,
      minLen: 2,
      notContains: 'b',
      pattern: '^[a-z]+$',
      prefix: 'p',
      protoName: 'sample_value',
      suffix: 's',
    });
  });

  it('reads uuid and ignores a disabled uuid rule', () => {
    expect(readSingleField({
      rules: stringRules({ wellKnown: { case: 'uuid', value: true } }),
      type: STRING,
    })).toEqual({ isUuid: true, kind: 'string', protoName: 'sample_value' });

    expect(readSingleField({
      rules: stringRules({ wellKnown: { case: 'uuid', value: false } }),
      type: STRING,
    })).toEqual({ kind: 'string', protoName: 'sample_value' });
  });

  it.each([
    ['const', { const: 'x' }],
    ['in', { in: ['x'] }],
    ['not_in', { notIn: ['x'] }],
    ['len_bytes', { lenBytes: 3n }],
    ['min_bytes', { minBytes: 3n }],
    ['email', { wellKnown: { case: 'email', value: true } }],
    ['well_known_regex', { wellKnown: { case: 'wellKnownRegex', value: KnownRegex.HTTP_HEADER_NAME } }],
    ['hostname', { wellKnown: { case: 'hostname', value: true } }],
  ] satisfies [string, MessageInitShape<typeof StringRulesSchema>][])(
    'marks %s as server only and keeps the supported rest',
    (_name, unsupported) => {
      expect(readSingleField({
        rules: stringRules({ minLen: 1n, ...unsupported }),
        type: STRING,
      })).toEqual({
        isServerOnly: true,
        kind: 'string',
        minLen: 1,
        protoName: 'sample_value',
      });
    });

  it('ignores example values', () => {
    expect(readSingleField({
      rules: stringRules({ example: ['x'], minLen: 1n }),
      type: STRING,
    })).toEqual({ kind: 'string', minLen: 1, protoName: 'sample_value' });
  });

  it('marks rules from predefined extensions as server only', () => {
    const rulesWithExtension = fromBinary(StringRulesSchema, Uint8Array.of(0xc8, 0x3e, 0x01));

    expect(rulesWithExtension.$unknown).toHaveLength(1);
    expect(readSingleField({
      rules: { type: { case: 'string', value: rulesWithExtension } },
      type: STRING,
    })).toEqual({ isServerOnly: true, kind: 'string', protoName: 'sample_value' });
  });

  it('marks a count beyond the safe integer range as server only', () => {
    expect(readSingleField({
      rules: stringRules({ maxLen: BigInt(Number.MAX_SAFE_INTEGER) + 1n }),
      type: STRING,
    })).toEqual({ isServerOnly: true, kind: 'string', protoName: 'sample_value' });
  });

  it('carries a portable pattern over as is and escapes nothing itself', () => {
    const pattern = '^[a-z\'\\\\]+\\d$';

    expect(readSingleField({ rules: stringRules({ pattern }), type: STRING })).toEqual({
      kind: 'string',
      pattern,
      protoName: 'sample_value',
    });
  });

  it.each([
    ['(?i)abc'],
    ['^a.b$'],
    ['\\s+'],
    ['[[:alpha:]]'],
    ['\\Aabc\\z'],
    ['(?P<name>a)'],
    ['\\pN'],
    ['[a'],
  ])('drops the pattern %s that does not carry over to JavaScript and marks the field server only', (pattern) => {
    expect(isPortableRegexPattern(pattern)).toBe(false);
    expect(readSingleField({ rules: stringRules({ maxLen: 9n, pattern }), type: STRING })).toEqual({
      isServerOnly: true,
      kind: 'string',
      maxLen: 9,
      protoName: 'sample_value',
    });
  });
});

describe('readMessageFormRules integers', () => {
  it('reads bounds of a 32-bit type as numbers', () => {
    expect(readSingleField({
      rules: { type: { case: 'int32', value: { greaterThan: { case: 'gte', value: 0 }, lessThan: { case: 'lte', value: 200 } } } },
      type: INT32,
    })).toEqual({
      gte: 0,
      kind: 'integer',
      lte: 200,
      protoName: 'sample_value',
      type: 'int32',
    });
  });

  it('reads bounds of a 64-bit type as bigint', () => {
    expect(readSingleField({
      rules: {
        type: {
          case: 'int64',
          value: { greaterThan: { case: 'gt', value: -5n }, lessThan: { case: 'lt', value: 9007199254740993n } },
        },
      },
      type: INT64,
    })).toEqual({
      gt: -5n,
      kind: 'integer',
      lt: 9007199254740993n,
      protoName: 'sample_value',
      type: 'int64',
    });
  });

  it('names the type after the protobuf type', () => {
    expect(readSingleField({
      rules: { type: { case: 'uint32', value: { lessThan: { case: 'lt', value: 10 } } } },
      type: UINT32,
    })).toMatchObject({ type: 'uint32' });
    expect(readSingleField({
      rules: { type: { case: 'sint64', value: { greaterThan: { case: 'gt', value: 1n } } } },
      type: SINT64,
    })).toMatchObject({ type: 'sint64' });
  });

  it.each([
    ['const', { const: 1 }],
    ['in', { in: [1] }],
    ['not_in', { notIn: [1] }],
  ] satisfies [string, MessageInitShape<typeof Int32RulesSchema>][])('marks %s as server only', (_name, unsupported) => {
    expect(readSingleField({
      rules: { type: { case: 'int32', value: { greaterThan: { case: 'gte', value: 1 }, ...unsupported } } },
      type: INT32,
    })).toEqual({
      gte: 1,
      isServerOnly: true,
      kind: 'integer',
      protoName: 'sample_value',
      type: 'int32',
    });
  });

  it('marks rules of another type than the field as server only', () => {
    expect(readSingleField({
      rules: stringRules({ minLen: 1n }),
      type: INT32,
    })).toEqual({ isServerOnly: true, kind: 'integer', protoName: 'sample_value', type: 'int32' });
  });
});

describe('readMessageFormRules enums', () => {
  const modeField = { type: ENUM, typeName: '.probe.v1.Mode' } as const;

  it('lists every defined number once for defined_only, including zero', () => {
    expect(readSingleField({
      ...modeField,
      rules: { type: { case: 'enum', value: { definedOnly: true } } },
    })).toEqual({
      definedValues: [0, 1, 2],
      kind: 'enum',
      protoName: 'sample_value',
    });
  });

  it('reads const, in and not_in', () => {
    expect(readSingleField({
      ...modeField,
      rules: { type: { case: 'enum', value: { const: 1, in: [1, 2], notIn: [0] } } },
    })).toEqual({
      equalTo: 1,
      in: [1, 2],
      kind: 'enum',
      notIn: [0],
      protoName: 'sample_value',
    });
  });

  it('does not list defined values when defined_only is false', () => {
    expect(readSingleField({
      ...modeField,
      rules: { type: { case: 'enum', value: { definedOnly: false } } },
    })).toEqual({ kind: 'enum', protoName: 'sample_value' });
  });
});

describe('readMessageFormRules repeated', () => {
  it('reads list rules with enum items', () => {
    expect(readSingleField({
      isRepeated: true,
      rules: {
        type: {
          case: 'repeated',
          value: {
            items: { type: { case: 'enum', value: { definedOnly: true, notIn: [0] } } },
            maxItems: 5n,
            minItems: 1n,
            unique: true,
          },
        },
      },
      type: ENUM,
      typeName: '.probe.v1.Mode',
    })).toEqual({
      isUnique: true,
      items: { definedValues: [0, 1, 2], kind: 'enum', notIn: [0] },
      kind: 'repeated',
      maxItems: 5,
      minItems: 1,
      protoName: 'sample_value',
    });
  });

  it('reads list rules with string items', () => {
    expect(readSingleField({
      isRepeated: true,
      rules: {
        type: {
          case: 'repeated',
          value: { items: { type: { case: 'string', value: { maxLen: 3n } } } },
        },
      },
      type: STRING,
    })).toEqual({
      items: { kind: 'string', maxLen: 3 },
      kind: 'repeated',
      protoName: 'sample_value',
    });
  });

  it('reads list rules with integer items', () => {
    expect(readSingleField({
      isRepeated: true,
      rules: {
        type: {
          case: 'repeated',
          value: { items: { type: { case: 'int32', value: { greaterThan: { case: 'gt', value: 0 } } } } },
        },
      },
      type: INT32,
    })).toEqual({
      items: { gt: 0, kind: 'integer', type: 'int32' },
      kind: 'repeated',
      protoName: 'sample_value',
    });
  });

  it('does not store empty item rules', () => {
    expect(readSingleField({
      isRepeated: true,
      rules: { type: { case: 'repeated', value: { items: {}, minItems: 1n } } },
      type: STRING,
    })).toEqual({ kind: 'repeated', minItems: 1, protoName: 'sample_value' });
  });

  it.each([
    ['ignore', { ignore: Ignore.IF_ZERO_VALUE, type: { case: 'string', value: { minLen: 1n } } }],
    ['required', { required: true, type: { case: 'string', value: { minLen: 1n } } }],
    ['cel', { cel: [{ expression: 'true', id: 'x' }], type: { case: 'string', value: { minLen: 1n } } }],
    ['unsupported element rule', { type: { case: 'string', value: { in: ['a'] } } }],
  ] satisfies [string, FieldRulesInit][])('marks item %s as server only', (_name, items) => {
    expect(readSingleField({
      isRepeated: true,
      rules: { type: { case: 'repeated', value: { items } } },
      type: STRING,
    })).toMatchObject({ isServerOnly: true, kind: 'repeated' });
  });

  it('marks unsupported list rules and a rule of another type as server only', () => {
    expect(readSingleField({
      isRepeated: true,
      rules: stringRules({ minLen: 1n }),
      type: STRING,
    })).toMatchObject({ isServerOnly: true, kind: 'repeated' });
  });

  it('marks lists of messages as server only and keeps the count rules', () => {
    expect(readSingleField({
      isRepeated: true,
      rules: { type: { case: 'repeated', value: { minItems: 1n } } },
      type: MESSAGE,
      typeName: '.probe.v1.Leaf',
    })).toEqual({
      isServerOnly: true,
      kind: 'repeated',
      minItems: 1,
      protoName: 'sample_value',
    });
  });

  it('marks lists of bools and doubles as server only', () => {
    expect(readSingleField({
      isRepeated: true,
      rules: { type: { case: 'repeated', value: { unique: true } } },
      type: BOOL,
    })).toMatchObject({ isServerOnly: true, kind: 'repeated' });
    expect(readSingleField({
      isRepeated: true,
      rules: { type: { case: 'repeated', value: { unique: true } } },
      type: DOUBLE,
    })).toMatchObject({ isServerOnly: true, kind: 'repeated' });
  });
});

describe('readMessageFormRules opaque fields', () => {
  it.each([
    ['bool', BOOL, { type: { case: 'bool', value: { const: true } } }],
    ['double', DOUBLE, { type: { case: 'double', value: { greaterThan: { case: 'gt', value: 0 } } } }],
    ['bytes', BYTES, { type: { case: 'bytes', value: { minLen: 1n } } }],
  ] satisfies [string, ProtoType, FieldRulesInit][])('marks %s as opaque and server only', (_name, type, rules) => {
    expect(readSingleField({ rules, type })).toEqual({
      isServerOnly: true,
      kind: 'opaque',
      protoName: 'sample_value',
    });
  });

  it('keeps required on a message field', () => {
    expect(readSingleField({
      rules: { required: true },
      type: MESSAGE,
      typeName: '.probe.v1.Leaf',
    })).toEqual({
      isRequired: true,
      isServerOnly: true,
      kind: 'opaque',
      protoName: 'sample_value',
    });
  });

  it('marks a map field as opaque', () => {
    const file = createProbeFile([{
      fields: [{
        isRepeated: true,
        name: 'labels',
        number: 1,
        rules: { type: { case: 'map', value: { minPairs: 1n } } },
        type: MESSAGE,
        typeName: '.probe.v1.Probe.LabelsEntry',
      }],
      name: 'Probe',
      nested: [{
        fields: [
          { name: 'key', number: 1, type: STRING },
          { name: 'value', number: 2, type: STRING },
        ],
        isMapEntry: true,
        name: 'LabelsEntry',
      }],
    }]);
    const message = file.messages[0];

    expect(message === undefined ? undefined : readMessageFormRules(message)?.fields.labels).toEqual({
      isServerOnly: true,
      kind: 'opaque',
      protoName: 'labels',
    });
  });
});

describe('readMessageFormRules field flags', () => {
  it('reads required', () => {
    expect(readSingleField({ rules: { required: true, ...stringRules({ minLen: 1n }) }, type: STRING })).toEqual({
      isRequired: true,
      kind: 'string',
      minLen: 1,
      protoName: 'sample_value',
    });
  });

  it('reads ignore', () => {
    const withIgnore = (ignore: Ignore): unknown =>
      readSingleField({ rules: { ignore, ...stringRules({ minLen: 1n }) }, type: STRING });

    expect(withIgnore(Ignore.ALWAYS)).toMatchObject({ ignore: 'always' });
    expect(withIgnore(Ignore.IF_ZERO_VALUE)).toMatchObject({ ignore: 'ifZeroValue' });
    expect(withIgnore(Ignore.UNSPECIFIED)).not.toHaveProperty('ignore');
  });

  it('marks the explicit presence of optional fields and of members of a declared oneof', () => {
    expect(readSingleField({
      isProto3Optional: true,
      rules: stringRules({ minLen: 1n }),
      type: STRING,
    })).toMatchObject({ hasPresence: true });

    const rules = readProbeRules(
      [
        { name: 'first', number: 1, oneofIndex: 0, rules: stringRules({ minLen: 1n }), type: STRING },
        { name: 'second', number: 2, oneofIndex: 0, rules: stringRules({ minLen: 1n }), type: STRING },
        { name: 'third', number: 3, rules: stringRules({ minLen: 1n }), type: STRING },
      ],
      { oneofs: [{ name: 'choice' }] },
    );

    expect(rules?.fields.first).toMatchObject({ hasPresence: true });
    expect(rules?.fields.second).toMatchObject({ hasPresence: true });
    expect(rules?.fields.third).not.toHaveProperty('hasPresence');
    expect(rules?.fields.first).not.toHaveProperty('ignore');
    expect(rules?.hasServerOnlyMessageRules).toBeUndefined();
  });

  it('marks field level CEL as server only and keeps the supported rules', () => {
    expect(readSingleField({
      rules: { cel: [{ expression: 'true', id: 'always' }], ...stringRules({ minLen: 1n }) },
      type: STRING,
    })).toEqual({ isServerOnly: true, kind: 'string', minLen: 1, protoName: 'sample_value' });
  });

  it('leaves fields without rules out of the table', () => {
    const rules = readProbeRules([
      { name: 'plain', number: 1, type: STRING },
      { name: 'checked', number: 2, rules: stringRules({ minLen: 1n }), type: STRING },
    ]);

    expect(Object.keys(rules?.fields ?? {})).toEqual(['checked']);
  });

  it('uses the local name as the key and the proto name inside', () => {
    expect(readProbeRules([{ name: 'time_zone_id', number: 1, rules: stringRules({ minLen: 1n }), type: STRING }])?.fields)
      .toEqual({ timeZoneId: { kind: 'string', minLen: 1, protoName: 'time_zone_id' } });
  });
});

describe('readMessageFormRules message rules', () => {
  const twoStrings: FieldSpec[] = [
    { name: 'first', number: 1, rules: stringRules({ maxLen: 5n }), type: STRING },
    { name: 'second', number: 2, rules: { ignore: Ignore.UNSPECIFIED, ...stringRules({ maxLen: 5n }) }, type: STRING },
    { name: 'third', number: 3, rules: { ignore: Ignore.ALWAYS, ...stringRules({ maxLen: 5n }) }, type: STRING },
    { name: 'fourth', number: 4, rules: stringRules({ maxLen: 5n }), type: STRING },
  ];

  it('treats fields of a message oneof rule as ignored when zero unless ignore is set', () => {
    const rules = readProbeRules(twoStrings, {
      messageRules: { oneof: [{ fields: ['first', 'second', 'third'], required: true }] },
    });

    expect(rules?.hasServerOnlyMessageRules).toBe(true);
    expect(rules?.fields.first).toMatchObject({ ignore: 'ifZeroValue' });
    expect(rules?.fields.second).not.toHaveProperty('ignore');
    expect(rules?.fields.third).toMatchObject({ ignore: 'always' });
    expect(rules?.fields.fourth).not.toHaveProperty('ignore');
  });

  it('flags message CEL', () => {
    expect(readProbeRules(twoStrings, {
      messageRules: { cel: [{ expression: 'true', id: 'always' }] },
    })?.hasServerOnlyMessageRules).toBe(true);
    expect(readProbeRules(twoStrings, {
      messageRules: { celExpression: ['true'] },
    })?.hasServerOnlyMessageRules).toBe(true);
  });

  it('flags a required oneof', () => {
    const rules = readProbeRules(
      [
        { name: 'first', number: 1, oneofIndex: 0, type: STRING },
        { name: 'second', number: 2, oneofIndex: 0, type: STRING },
      ],
      { oneofs: [{ name: 'choice', rules: { required: true } }] },
    );

    expect(rules).toEqual({ fields: {}, hasServerOnlyMessageRules: true });
  });

  it('does not flag a oneof that is not required', () => {
    expect(readProbeRules(
      [{ name: 'first', number: 1, oneofIndex: 0, type: STRING }],
      { oneofs: [{ name: 'choice', rules: { required: false } }] },
    )).toBeUndefined();
  });

  it('returns nothing for a message without rules', () => {
    expect(readProbeRules([{ name: 'plain', number: 1, type: STRING }])).toBeUndefined();
  });

  it('does not add the message flag for field rules only', () => {
    expect(readProbeRules(twoStrings)).not.toHaveProperty('hasServerOnlyMessageRules');
  });
});

describe('readFileFormRules', () => {
  it('names exports after the message and nested messages after their parents', () => {
    const file = createProbeFile([
      {
        fields: [{ name: 'title', number: 1, rules: stringRules({ minLen: 1n }), type: STRING }],
        name: 'Outer',
        nested: [
          {
            fields: [{ name: 'code', number: 1, rules: stringRules({ len: 3n }), type: STRING }],
            name: 'Inner',
            nested: [{
              fields: [{ name: 'tag', number: 1, rules: stringRules({ maxLen: 2n }), type: STRING }],
              name: 'Deep',
            }],
          },
        ],
      },
      { fields: [{ name: 'plain', number: 1, type: STRING }], name: 'Plain' },
      { fields: [{ name: 'note', number: 1, rules: stringRules({ maxLen: 9n }), type: STRING }], name: 'Note' },
    ]);

    expect(readFileFormRules(file).map(message => message.exportName)).toEqual([
      'OuterFormRules',
      'Outer_InnerFormRules',
      'Outer_Inner_DeepFormRules',
      'NoteFormRules',
    ]);
  });
});

describe('readFileFormRules on the current contract', () => {
  const registry = loadContractRegistry(new URL('../src/gen/contract.binpb', import.meta.url).pathname);

  it('builds the table of CreateWarehouseRequest', () => {
    const file = registry.getFile('organization/v1/organization.proto');

    if (file === undefined) {
      throw new Error('The contract image has no organization file');
    }

    const message = readFileFormRules(file).find(entry => entry.exportName === 'CreateWarehouseRequestFormRules');

    expect(message?.rules).toEqual({
      fields: {
        address: { kind: 'string', maxLen: 500, protoName: 'address' },
        boardNodeId: { isUuid: true, kind: 'string', protoName: 'board_node_id' },
        capabilities: {
          isUnique: true,
          items: { definedValues: [0, 1, 2, 3], kind: 'enum', notIn: [0] },
          kind: 'repeated',
          protoName: 'capabilities',
        },
        cityId: { isUuid: true, kind: 'string', protoName: 'city_id' },
        idempotencyKey: { isUuid: true, kind: 'string', protoName: 'idempotency_key' },
        name: { isRequired: true, kind: 'string', maxLen: 120, protoName: 'name' },
        timeZone: {
          isRequired: true,
          kind: 'string',
          pattern: '^[A-Za-z_]+(/[A-Za-z0-9_+-]+)+$',
          protoName: 'time_zone',
        },
      },
    });
  });

  it('carries every pattern of the contract over to JavaScript', () => {
    const collectMessages = (messages: readonly DescMessage[]): DescMessage[] =>
      messages.flatMap(message => [message, ...collectMessages(message.nestedMessages)]);

    const patterns = [...registry.files]
      .filter(file => !file.name.startsWith('google/') && !file.name.startsWith('buf/validate/'))
      .flatMap(file => collectMessages(file.messages))
      .flatMap(message => message.fields)
      .filter(field => hasOption(field, fieldRulesExtension))
      .map(field => getOption(field, fieldRulesExtension).type)
      .flatMap(type => (type.case === 'string' && type.value.pattern !== '' ? [type.value.pattern] : []));

    expect(patterns.length).toBeGreaterThan(0);
    expect(patterns.filter(pattern => !isPortableRegexPattern(pattern))).toEqual([]);
  });
});
