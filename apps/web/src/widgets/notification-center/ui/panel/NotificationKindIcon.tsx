import type { Notification } from '@skladburg/contracts/notification/v1/notification';
import type { ReactElement } from 'react';

import { NotificationKind } from '@skladburg/contracts/notification/v1/notification';
import {
  Bell,
  CircleArrowUp,
  KeyRound,
  LifeBuoy,
  ShieldAlert,
  ShieldCheck,
  Warehouse,
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

export const NotificationKindIcon = ({ notification }: NotificationKindIconProps): ReactElement => {
  switch (notification.params.case) {
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
