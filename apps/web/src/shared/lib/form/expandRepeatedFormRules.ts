import type {
  FormFieldRulesValue,
  FormRulesValue,
} from '@skladburg/contracts/forms';

const toRowFieldRules = (itemField: FormFieldRulesValue, parentProtoName: string, index: number): FormFieldRulesValue => ({
  ...itemField,
  ignore: itemField.ignore ?? 'ifZeroValue',
  isRequired: false,
  protoName: `${parentProtoName}[${String(index)}].${itemField.protoName}`,
});

export const expandRepeatedFormRules = (
  rules: FormRulesValue,
  field: string,
  itemRules: FormRulesValue,
  capacity: number,
): FormRulesValue => {
  const parentProtoName = rules.fields[field]?.protoName ?? field;
  const fields: Record<string, FormFieldRulesValue> = {};

  for (const [name, fieldRules] of Object.entries(rules.fields)) {
    if (name !== field) {
      fields[name] = fieldRules;
    }
  }

  for (let index = 0; index < capacity; index += 1) {
    for (const [itemName, itemField] of Object.entries(itemRules.fields)) {
      fields[`${field}.${String(index)}.${itemName}`] = toRowFieldRules(itemField, parentProtoName, index);
    }
  }

  return { ...rules, fields };
};
