export const PLATFORM_OPERATOR_ORGANIZATION_ID = '10000000-0000-4000-8000-000000000000';

export const isPlatformOperator = (organizationId: string): boolean =>
  organizationId === PLATFORM_OPERATOR_ORGANIZATION_ID;
