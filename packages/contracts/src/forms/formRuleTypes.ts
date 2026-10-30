export type FieldCheckRunnerValue = (
  check: FormFieldCheckValue,
  value: string,
  peerValue: string | undefined,
) => string | undefined;

export interface FormEnumRuleValue {
  definedValues?: readonly number[];
  equalTo?: number;
  in?: readonly number[];
  kind: 'enum';
  notIn?: readonly number[];
}

export type FormFieldCheckKindValue
  = | 'bik'
    | 'correspondentAccount'
    | 'gtin'
    | 'inn'
    | 'kpp'
    | 'ogrn'
    | 'settlementAccount';

export interface FormFieldCheckValue {
  kind: FormFieldCheckKindValue;
  peerField?: string;
}

export interface FormFieldCommonValue {
  check?: FormFieldCheckValue;
  hasPresence?: boolean;
  ignore?: FormIgnoreValue;
  isRequired?: boolean;
  isServerOnly?: boolean;
  protoName: string;
}

export interface FormFieldIssueValue {
  field: string;
  ruleId: string;
}

export type FormFieldRulesValue = FormFieldCommonValue & FormRuleValue;

export type FormIgnoreValue = 'always' | 'ifZeroValue';

export interface FormIntegerRuleValue {
  gt?: bigint | number;
  gte?: bigint | number;
  kind: 'integer';
  lt?: bigint | number;
  lte?: bigint | number;
  type: FormIntegerTypeValue;
}

export type FormIntegerTypeValue
  = | 'fixed32'
    | 'fixed64'
    | 'int32'
    | 'int64'
    | 'sfixed32'
    | 'sfixed64'
    | 'sint32'
    | 'sint64'
    | 'uint32'
    | 'uint64';

export interface FormOpaqueRuleValue {
  kind: 'opaque';
}

export interface FormRepeatedRuleValue {
  isUnique?: boolean;
  items?: FormScalarRuleValue;
  kind: 'repeated';
  maxItems?: number;
  minItems?: number;
}

export interface FormRulesValue {
  fields: Readonly<Record<string, FormFieldRulesValue>>;
  hasServerOnlyMessageRules?: boolean;
}

export type FormRuleValue = FormOpaqueRuleValue | FormRepeatedRuleValue | FormScalarRuleValue;

export type FormScalarRuleValue = FormEnumRuleValue | FormIntegerRuleValue | FormStringRuleValue;

export interface FormStringRuleValue {
  contains?: string;
  isUuid?: boolean;
  kind: 'string';
  len?: number;
  maxLen?: number;
  minLen?: number;
  notContains?: string;
  pattern?: string;
  prefix?: string;
  suffix?: string;
}
