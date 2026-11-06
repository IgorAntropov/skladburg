export const DEAL_RULE_IDS = [
  'deal.date.invalid',
  'deal.delivery_method.unavailable',
  'deal.goods_total.mismatch',
  'deal.lines.mismatch',
  'deal.price.below_minimum',
  'deal.price.discount_forbidden',
  'deal.product.unit_mismatch',
  'deal.quantity.unavailable',
  'deal.same_organization',
  'deal.warehouse.unavailable',
  'payment.amount.mismatch',
] as const;

export type DealRuleId = typeof DEAL_RULE_IDS[number];
