import type { Notification } from '@skladburg/contracts/notification/v1/notification';
import type { ReactElement } from 'react';

import {
  DealNotice,
  NotificationKind,
} from '@skladburg/contracts/notification/v1/notification';
import {
  Bell,
  CircleArrowUp,
  FileText,
  KeyRound,
  LifeBuoy,
  MessageCircle,
  ShieldAlert,
  ShieldCheck,
  Truck,
  Warehouse,
  X,
} from 'lucide-react';

interface NotificationKindIconProps {
  notification: Notification;
}

const ICON_CLASS_NAME = 'size-4';

const renderSupportAccessIcon = ({ kind }: Notification): ReactElement => {
  switch (kind) {
    case NotificationKind.SUPPORT_ACCESS_REQUESTED:
      return <KeyRound className={ICON_CLASS_NAME} />;
    case NotificationKind.SUPPORT_EMERGENCY_ACCESS_STARTED:
      return <ShieldAlert className={ICON_CLASS_NAME} />;
    default:
      return <Bell className={ICON_CLASS_NAME} />;
  }
};

const renderDealIcon = (notice: DealNotice): ReactElement => {
  switch (notice) {
    case DealNotice.ACCEPTED:
    case DealNotice.CONFIRMED:
    case DealNotice.PAID_OUT:
      return <ShieldCheck className={ICON_CLASS_NAME} />;
    case DealNotice.ARRIVED:
    case DealNotice.SHIPPED:
      return <Truck className={ICON_CLASS_NAME} />;
    case DealNotice.CANCELLED:
    case DealNotice.REJECTED:
      return <X className={ICON_CLASS_NAME} />;
    case DealNotice.COUNTER_OFFERED:
      return <MessageCircle className={ICON_CLASS_NAME} />;
    case DealNotice.DOCUMENTS_READY:
    case DealNotice.FUNDS_BLOCKED:
    case DealNotice.RECEIVED:
      return <FileText className={ICON_CLASS_NAME} />;
    default:
      return <Bell className={ICON_CLASS_NAME} />;
  }
};

export const NotificationKindIcon = ({ notification }: NotificationKindIconProps): ReactElement => {
  switch (notification.params.case) {
    case 'dealUpdate':
      return renderDealIcon(notification.params.value.notice);
    case 'partnerVerified':
      return <ShieldCheck className={ICON_CLASS_NAME} />;
    case 'supportAccess':
      return renderSupportAccessIcon(notification);
    case 'supportReply':
      return <LifeBuoy className={ICON_CLASS_NAME} />;
    case undefined:
      return <Bell className={ICON_CLASS_NAME} />;
    case 'verificationNextLevel':
      return <CircleArrowUp className={ICON_CLASS_NAME} />;
    case 'warehouseCreated':
      return <Warehouse className={ICON_CLASS_NAME} />;
  }
};
