import type { Notification } from '@skladburg/contracts/notification/v1/notification';
import type { ReactElement } from 'react';

import {
  Bell,
  CircleArrowUp,
  ShieldCheck,
  Warehouse,
} from 'lucide-react';

interface NotificationKindIconProps {
  notification: Notification;
}

const ICON_CLASS_NAME = 'size-4';

export const NotificationKindIcon = ({ notification }: NotificationKindIconProps): ReactElement => {
  switch (notification.params.case) {
    case 'partnerVerified':
      return <ShieldCheck className={ICON_CLASS_NAME} />;
    case undefined:
      return <Bell className={ICON_CLASS_NAME} />;
    case 'verificationNextLevel':
      return <CircleArrowUp className={ICON_CLASS_NAME} />;
    case 'warehouseCreated':
      return <Warehouse className={ICON_CLASS_NAME} />;
  }
};
