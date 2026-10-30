import type {
  DescMessage,
  FileRegistry,
  JsonObject,
} from '@bufbuild/protobuf';

import {
  create,
  createFileRegistry,
  fromJson,
  setExtension,
} from '@bufbuild/protobuf';
import {
  DescriptorProtoSchema,
  FieldDescriptorProto_Label,
  FieldDescriptorProto_Type,
  FieldDescriptorProtoSchema,
  FieldOptionsSchema,
  file_google_protobuf_descriptor,
  FileDescriptorProtoSchema,
  FileDescriptorSetSchema,
  MessageOptionsSchema,
} from '@bufbuild/protobuf/wkt';
import {
  FieldCheck,
  field_check as fieldCheckExtension,
  file_common_v1_field_options,
} from '@skladburg/contracts/common/v1/field_options';
import { UpdateOrganizationRequisitesRequestSchema } from '@skladburg/contracts/organization/v1/requisites';
import { getContractRegistry } from '@skladburg/contracts/registry';
import {
  describe,
  expect,
  it,
} from 'vitest';

import { collectFieldCheckViolations } from './fieldChecks';

interface FieldSpec {
  check?: FieldCheck;
  isRepeated?: boolean;
  name: string;
  number: number;
  type: FieldDescriptorProto_Type;
  typeName?: string;
}

const STRING = FieldDescriptorProto_Type.STRING;
const MESSAGE = FieldDescriptorProto_Type.MESSAGE;

const VALID_BIK = '040000777';
const VALID_SETTLEMENT_ACCOUNT = '40702810700000000123';
const VALID_CORRESPONDENT_ACCOUNT = '30101810900000000777';
const WRONG_SETTLEMENT_ACCOUNT = '40702810800000000123';
const WRONG_CORRESPONDENT_ACCOUNT = '30101810800000000777';
const VALID_INN = '0000000018';
const WRONG_INN = '0000000019';

const createField = (spec: FieldSpec): ReturnType<typeof create<typeof FieldDescriptorProtoSchema>> => {
  const options = create(FieldOptionsSchema);

  if (spec.check !== undefined) {
    setExtension(options, fieldCheckExtension, spec.check);
  }

  return create(FieldDescriptorProtoSchema, {
    jsonName: spec.name.replace(/_([a-z])/g, (_match, letter: string) => letter.toUpperCase()),
    label: spec.isRepeated === true ? FieldDescriptorProto_Label.REPEATED : FieldDescriptorProto_Label.OPTIONAL,
    name: spec.name,
    number: spec.number,
    options,
    type: spec.type,
    typeName: spec.typeName,
  });
};

const createRegistry = (): FileRegistry =>
  createFileRegistry(create(FileDescriptorSetSchema, {
    file: [
      file_google_protobuf_descriptor.proto,
      file_common_v1_field_options.proto,
      create(FileDescriptorProtoSchema, {
        dependency: ['common/v1/field_options.proto'],
        messageType: [
          create(DescriptorProtoSchema, {
            field: [
              createField({ check: FieldCheck.BIK, name: 'bik', number: 1, type: STRING }),
              createField({ check: FieldCheck.SETTLEMENT_ACCOUNT, name: 'settlement_account', number: 2, type: STRING }),
              createField({ check: FieldCheck.CORRESPONDENT_ACCOUNT, name: 'correspondent_account', number: 3, type: STRING }),
              createField({ name: 'note', number: 4, type: STRING }),
            ],
            name: 'Account',
          }),
          create(DescriptorProtoSchema, {
            field: [
              createField({ name: 'label', number: 1, type: STRING }),
            ],
            name: 'Plain',
          }),
          create(DescriptorProtoSchema, {
            field: [
              createField({ check: FieldCheck.INN, name: 'inn', number: 1, type: STRING }),
              createField({ name: 'primary', number: 2, type: MESSAGE, typeName: '.probe.v1.Account' }),
              createField({ isRepeated: true, name: 'items', number: 3, type: MESSAGE, typeName: '.probe.v1.Account' }),
              createField({ isRepeated: true, name: 'by_name', number: 4, type: MESSAGE, typeName: '.probe.v1.Holder.ByNameEntry' }),
              createField({ name: 'plain', number: 5, type: MESSAGE, typeName: '.probe.v1.Plain' }),
              createField({ check: FieldCheck.INN, isRepeated: true, name: 'inns', number: 6, type: STRING }),
              createField({ name: 'next', number: 7, type: MESSAGE, typeName: '.probe.v1.Holder' }),
            ],
            name: 'Holder',
            nestedType: [
              create(DescriptorProtoSchema, {
                field: [
                  createField({ name: 'key', number: 1, type: STRING }),
                  createField({ name: 'value', number: 2, type: MESSAGE, typeName: '.probe.v1.Account' }),
                ],
                name: 'ByNameEntry',
                options: create(MessageOptionsSchema, { mapEntry: true }),
              }),
            ],
          }),
        ],
        name: 'probe/v1/probe.proto',
        package: 'probe.v1',
        syntax: 'proto3',
      }),
    ],
  }));

const registry = createRegistry();

const getMessage = (name: string): DescMessage => {
  const message = registry.getMessage(`probe.v1.${name}`);

  if (message === undefined) {
    throw new Error(`Probe message ${name} is missing`);
  }

  return message;
};

const holder = getMessage('Holder');

const validAccount = {
  bik: VALID_BIK,
  correspondentAccount: VALID_CORRESPONDENT_ACCOUNT,
  settlementAccount: VALID_SETTLEMENT_ACCOUNT,
};

const collect = (json: JsonObject, skipped: readonly string[] = []): ReturnType<typeof collectFieldCheckViolations> => {
  const message = fromJson(holder, json);

  return collectFieldCheckViolations(holder, message, new Set(skipped));
};

describe('collectFieldCheckViolations', () => {
  it('finds nothing in correct values', () => {
    expect(collect({ inn: VALID_INN, primary: validAccount })).toEqual([]);
  });

  it('finds nothing in an empty message', () => {
    expect(collect({})).toEqual([]);
  });

  it('reports a wrong INN with the rule id of its kind', () => {
    expect(collect({ inn: WRONG_INN })).toEqual([{ fieldPath: 'inn', ruleId: 'field_check.inn' }]);
  });

  it('reports the accounts of a nested message with the dotted path', () => {
    expect(collect({
      primary: {
        ...validAccount,
        correspondentAccount: WRONG_CORRESPONDENT_ACCOUNT,
        settlementAccount: WRONG_SETTLEMENT_ACCOUNT,
      },
    })).toEqual([
      { fieldPath: 'primary.settlement_account', ruleId: 'field_check.settlement_account' },
      { fieldPath: 'primary.correspondent_account', ruleId: 'field_check.correspondent_account' },
    ]);
  });

  it('walks the elements of a list with their indexes', () => {
    expect(collect({
      items: [validAccount, { ...validAccount, settlementAccount: WRONG_SETTLEMENT_ACCOUNT }, validAccount],
    })).toEqual([{ fieldPath: 'items[1].settlement_account', ruleId: 'field_check.settlement_account' }]);
  });

  it('walks the values of a map with their keys', () => {
    expect(collect({
      byName: { first: validAccount, second: { ...validAccount, correspondentAccount: WRONG_CORRESPONDENT_ACCOUNT } },
    })).toEqual([{ fieldPath: 'by_name["second"].correspondent_account', ruleId: 'field_check.correspondent_account' }]);
  });

  it('checks the BIK of every message on its own', () => {
    expect(collect({
      items: [
        { ...validAccount, bik: '040012345' },
        { bik: '040012345', settlementAccount: '40702810500000000456' },
      ],
      primary: validAccount,
    })).toEqual([
      { fieldPath: 'items[0].settlement_account', ruleId: 'field_check.settlement_account' },
      { fieldPath: 'items[0].correspondent_account', ruleId: 'field_check.correspondent_account' },
    ]);
  });

  it('does not check an empty value', () => {
    expect(collect({ inn: '', primary: { bik: VALID_BIK, settlementAccount: '' } })).toEqual([]);
  });

  it('does not check a field that already has a violation of another rule', () => {
    expect(collect({ inn: WRONG_INN, primary: { ...validAccount, settlementAccount: WRONG_SETTLEMENT_ACCOUNT } }, [
      'inn',
      'primary.settlement_account',
    ])).toEqual([]);
  });

  it('does not check an account while the BIK is empty', () => {
    expect(collect({ primary: { settlementAccount: WRONG_SETTLEMENT_ACCOUNT } })).toEqual([]);
  });

  it('does not check an account while the BIK has a violation of another rule', () => {
    expect(collect({ primary: { ...validAccount, bik: '04000077', settlementAccount: WRONG_SETTLEMENT_ACCOUNT } }, ['primary.bik']))
      .toEqual([]);
  });

  it('does not check an account while the BIK itself is malformed', () => {
    expect(collect({ primary: { bik: '050000777', settlementAccount: WRONG_SETTLEMENT_ACCOUNT } })).toEqual([
      { fieldPath: 'primary.bik', ruleId: 'field_check.bik' },
    ]);
  });

  it('ignores a message without any check and a field without one', () => {
    expect(collect({ plain: { label: 'x' }, primary: { ...validAccount, note: 'free text' } })).toEqual([]);
  });

  it('does not check the elements of a list of strings', () => {
    expect(collect({ inns: [WRONG_INN] })).toEqual([]);
  });

  it('walks a message that points at its own type without looping', () => {
    expect(collect({ next: { inn: WRONG_INN, next: { inn: WRONG_INN } } })).toEqual([
      { fieldPath: 'next.inn', ruleId: 'field_check.inn' },
      { fieldPath: 'next.next.inn', ruleId: 'field_check.inn' },
    ]);
  });
});

describe('collectFieldCheckViolations on the contract', () => {
  const schema = getContractRegistry().getMessage(UpdateOrganizationRequisitesRequestSchema.typeName);

  it('walks the bank of the requisites request', () => {
    expect(schema).toBeDefined();

    if (schema === undefined) {
      return;
    }

    const message = fromJson(schema, {
      bank: {
        bankName: 'АО «Банк Складбург»',
        bik: '040000501',
        correspondentAccount: '30101810600000000501',
        settlementAccount: '40702810400000000001',
      },
    });

    expect(collectFieldCheckViolations(schema, message, new Set())).toEqual([
      { fieldPath: 'bank.settlement_account', ruleId: 'field_check.settlement_account' },
    ]);
  });
});
