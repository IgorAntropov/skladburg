export const ContractRule = {
  ACCESS_INVALID: 'access_invalid',
  ACCESS_MISSING: 'access_missing',
  COMMAND_DECLARED_AS_QUERY: 'command_declared_as_query',
  ERROR_PARAMS_ORPHAN: 'error_params_orphan',
  ERROR_TRAITS_MISSING: 'error_traits_missing',
  IDEMPOTENCY_KEY_MISSING: 'idempotency_key_missing',
  IDEMPOTENCY_KEY_UNEXPECTED: 'idempotency_key_unexpected',
  LIMIT_FIELD_INVALID: 'limit_field_invalid',
  PACKAGE_NAME_INVALID: 'package_name_invalid',
  PAGINATION_MISSING: 'pagination_missing',
  PERMISSION_ACTION_UNKNOWN: 'permission_action_unknown',
  QUERY_HAS_SIDE_EFFECTS: 'query_has_side_effects',
  SCOPE_FIELD_INVALID: 'scope_field_invalid',
} as const;

export type ContractRule = typeof ContractRule[keyof typeof ContractRule];

export interface ContractViolationValue {
  element: string;
  rule: ContractRule;
}
