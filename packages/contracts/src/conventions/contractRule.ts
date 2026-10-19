export const ContractRule = {
  ACCESS_INVALID: 'access_invalid',
  ACCESS_MISSING: 'access_missing',
  COMMAND_DECLARED_AS_QUERY: 'command_declared_as_query',
  COMMAND_PERMISSION_MISSING: 'command_permission_missing',
  ERROR_PARAMS_ORPHAN: 'error_params_orphan',
  ERROR_TRAITS_MISSING: 'error_traits_missing',
  IDEMPOTENCY_KEY_MISSING: 'idempotency_key_missing',
  IDEMPOTENCY_KEY_UNEXPECTED: 'idempotency_key_unexpected',
  LIMIT_FIELD_INVALID: 'limit_field_invalid',
  LIMIT_FIELD_NOT_REQUIRED: 'limit_field_not_required',
  LIMIT_FIELD_ON_QUERY: 'limit_field_on_query',
  LIMIT_NOT_APPLICABLE: 'limit_not_applicable',
  PACKAGE_NAME_INVALID: 'package_name_invalid',
  PAGINATION_MISSING: 'pagination_missing',
  PERMISSION_ACTION_UNKNOWN: 'permission_action_unknown',
  PERMISSION_CODE_INVALID: 'permission_code_invalid',
  PERMISSION_NOT_IN_CATALOG: 'permission_not_in_catalog',
  PERMISSION_TRAITS_MISSING: 'permission_traits_missing',
  QUERY_HAS_SIDE_EFFECTS: 'query_has_side_effects',
  SCOPE_FIELD_INVALID: 'scope_field_invalid',
  SCOPE_NOT_APPLICABLE: 'scope_not_applicable',
} as const;

export type ContractRule = typeof ContractRule[keyof typeof ContractRule];

export interface ContractViolationValue {
  element: string;
  rule: ContractRule;
}
