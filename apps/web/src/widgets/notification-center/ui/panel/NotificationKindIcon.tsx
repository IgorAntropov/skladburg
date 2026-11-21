import type { Notification } from '@skladburg/contracts/notification/v1/notification';
import type {
  ComponentType,
  ReactElement,
} from 'react';

import {
  Bell,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import {
  lazy,
  Suspense,
} from 'react';

interface NotificationKindIconProps {
  notification: Notification;
}

const DefaultIcon = (): ReactElement => <Bell className="size-4" />;

const NotificationCategoryIcon = lazy(async (): Promise<{ default: ComponentType<NotificationKindIconProps> }> => {
  try {
    const category = await import('./NotificationCategoryIcon');
    return { default: category.NotificationCategoryIcon };
  }
  catch {
    return { default: DefaultIcon };
  }
});

export const NotificationKindIcon = ({ notification }: NotificationKindIconProps): ReactElement => {
  if (notification.params.case === 'warehouseSensorAlert') {
    return notification.params.value.resolvedAt === undefined
      ? <ShieldAlert className="size-4 text-status-alarm" />
      : <ShieldCheck className="size-4" />;
  }

  return (
    <Suspense fallback={<DefaultIcon />}>
      <NotificationCategoryIcon notification={notification} />
    </Suspense>
  );
};
