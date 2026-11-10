import type { EffectivePermission } from '@skladburg/contracts/access/v1/access';
import type { Money } from '@skladburg/contracts/common/v1/money';

export const findOrganizationApprovalLimit = (
  permissions: readonly EffectivePermission[],
  requested: Money,
  permission: string,
): Money | undefined => {
  let maximum: Money | undefined;
  let currencyMaximum: Money | undefined;

  for (const grant of permissions) {
    if (grant.permission !== permission || !grant.isOrganizationWide) {
      continue;
    }

    const limit = grant.amountLimit;
    if (limit === undefined || (limit.currencyCode === requested.currencyCode && limit.amountMinor >= requested.amountMinor)) {
      return undefined;
    }

    if (maximum === undefined || limit.amountMinor > maximum.amountMinor) {
      maximum = limit;
    }

    const isGreaterCurrencyLimit = currencyMaximum === undefined || limit.amountMinor > currencyMaximum.amountMinor;
    if (limit.currencyCode === requested.currencyCode && isGreaterCurrencyLimit) {
      currencyMaximum = limit;
    }
  }

  return currencyMaximum ?? maximum;
};
