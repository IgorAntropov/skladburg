interface NotificationKeysValue {
  all: readonly ['notification'];
  digest: (organizationScope: string) => readonly ['notification', 'digest', string];
  list: (organizationScope: string) => readonly ['notification', 'list', string];
}

export const notificationKeys: NotificationKeysValue = {
  all: ['notification'],
  digest: organizationScope => ['notification', 'digest', organizationScope],
  list: organizationScope => ['notification', 'list', organizationScope],
};
