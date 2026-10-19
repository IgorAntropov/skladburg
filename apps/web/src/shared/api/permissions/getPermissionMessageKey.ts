import type { KnownPermissionCode } from '@skladburg/contracts/runtime';

import { PermissionCode } from '@skladburg/contracts/access/v1/permission';
import { findPermissionCode } from '@skladburg/contracts/runtime';

import type { MessageKey } from '@/shared/i18n';

const PERMISSION_MESSAGE_KEYS = {
  [PermissionCode.ANALYTICS_EXPORT]: 'permission.analytics_export',
  [PermissionCode.ANALYTICS_VIEW]: 'permission.analytics_view',
  [PermissionCode.AUTO_ORDER_APPROVE]: 'permission.auto_order_approve',
  [PermissionCode.AUTO_ORDER_MANAGE]: 'permission.auto_order_manage',
  [PermissionCode.AUTO_ORDER_VIEW]: 'permission.auto_order_view',
  [PermissionCode.CATALOG_EDIT]: 'permission.catalog_edit',
  [PermissionCode.CATALOG_VIEW]: 'permission.catalog_view',
  [PermissionCode.CLAIM_APPROVE]: 'permission.claim_approve',
  [PermissionCode.CLAIM_CREATE]: 'permission.claim_create',
  [PermissionCode.CLAIM_VIEW]: 'permission.claim_view',
  [PermissionCode.CONTRACT_EDIT]: 'permission.contract_edit',
  [PermissionCode.CONTRACT_SIGN]: 'permission.contract_sign',
  [PermissionCode.CONTRACT_VIEW]: 'permission.contract_view',
  [PermissionCode.DEAL_APPROVE]: 'permission.deal_approve',
  [PermissionCode.DEAL_CREATE]: 'permission.deal_create',
  [PermissionCode.DEAL_EDIT]: 'permission.deal_edit',
  [PermissionCode.DEAL_VIEW]: 'permission.deal_view',
  [PermissionCode.DOCUMENT_EXPORT]: 'permission.document_export',
  [PermissionCode.DOCUMENT_SIGN]: 'permission.document_sign',
  [PermissionCode.DOCUMENT_VIEW]: 'permission.document_view',
  [PermissionCode.FLEET_EDIT]: 'permission.fleet_edit',
  [PermissionCode.FLEET_VIEW]: 'permission.fleet_view',
  [PermissionCode.INVENTORY_EDIT]: 'permission.inventory_edit',
  [PermissionCode.INVENTORY_EXPORT]: 'permission.inventory_export',
  [PermissionCode.INVENTORY_VIEW]: 'permission.inventory_view',
  [PermissionCode.LAYOUT_EDIT]: 'permission.layout_edit',
  [PermissionCode.MARKETPLACE_VIEW]: 'permission.marketplace_view',
  [PermissionCode.MEMBER_MANAGE]: 'permission.member_manage',
  [PermissionCode.MEMBER_VIEW]: 'permission.member_view',
  [PermissionCode.NETWORK_VIEW]: 'permission.network_view',
  [PermissionCode.NOTIFICATION_MANAGE]: 'permission.notification_manage',
  [PermissionCode.ORGANIZATION_EDIT]: 'permission.organization_edit',
  [PermissionCode.ORGANIZATION_MANAGE]: 'permission.organization_manage',
  [PermissionCode.PAYMENT_FUND]: 'permission.payment_fund',
  [PermissionCode.PAYMENT_RELEASE]: 'permission.payment_release',
  [PermissionCode.PAYMENT_VIEW]: 'permission.payment_view',
  [PermissionCode.PRICE_LIST_EDIT]: 'permission.price_list_edit',
  [PermissionCode.PRICE_LIST_VIEW]: 'permission.price_list_view',
  [PermissionCode.PROMOTION_EDIT]: 'permission.promotion_edit',
  [PermissionCode.PROMOTION_VIEW]: 'permission.promotion_view',
  [PermissionCode.REVIEW_CREATE]: 'permission.review_create',
  [PermissionCode.SENSOR_MANAGE]: 'permission.sensor_manage',
  [PermissionCode.SENSOR_VIEW]: 'permission.sensor_view',
  [PermissionCode.STAFF_MANAGE]: 'permission.staff_manage',
  [PermissionCode.STAFF_VIEW]: 'permission.staff_view',
  [PermissionCode.TASK_CREATE]: 'permission.task_create',
  [PermissionCode.TASK_EDIT]: 'permission.task_edit',
  [PermissionCode.TASK_VIEW]: 'permission.task_view',
  [PermissionCode.TRANSPORT_OFFER_APPROVE]: 'permission.transport_offer_approve',
  [PermissionCode.TRANSPORT_OFFER_CREATE]: 'permission.transport_offer_create',
  [PermissionCode.TRANSPORT_REQUEST_CREATE]: 'permission.transport_request_create',
  [PermissionCode.TRANSPORT_REQUEST_VIEW]: 'permission.transport_request_view',
  [PermissionCode.TRIP_EDIT]: 'permission.trip_edit',
  [PermissionCode.TRIP_VIEW]: 'permission.trip_view',
  [PermissionCode.WAREHOUSE_CREATE]: 'permission.warehouse_create',
  [PermissionCode.WAREHOUSE_EDIT]: 'permission.warehouse_edit',
  [PermissionCode.WAREHOUSE_VIEW]: 'permission.warehouse_view',
  [PermissionCode.YARD_MANAGE]: 'permission.yard_manage',
  [PermissionCode.YARD_VIEW]: 'permission.yard_view',
} as const satisfies Record<KnownPermissionCode, MessageKey>;

export type PermissionMessageKeyValue = (typeof PERMISSION_MESSAGE_KEYS)[KnownPermissionCode];

export const getPermissionMessageKey = (permission: string): PermissionMessageKeyValue | undefined => {
  const code = findPermissionCode(permission);

  return code === undefined ? undefined : PERMISSION_MESSAGE_KEYS[code];
};
