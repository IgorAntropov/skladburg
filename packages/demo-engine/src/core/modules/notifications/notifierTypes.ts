import type { ObjectLink } from '@skladburg/contracts/common/v1/object_link';
import type {
  Notification,
  NotificationImportance,
  NotificationKind,
} from '@skladburg/contracts/notification/v1/notification';

import type { IStateTransaction } from '../../state/index';

export interface INotifier {
  post: (transaction: IStateTransaction, input: PostNotificationInputValue) => string[];
}

export interface PostNotificationInputValue {
  importance: NotificationImportance;
  kind: NotificationKind;
  links: readonly ObjectLink[];
  organizationId: string;
  params: Notification['params'];
  recipients: readonly string[];
}
