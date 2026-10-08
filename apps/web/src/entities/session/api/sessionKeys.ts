interface SessionKeysValue {
  all: readonly ['session'];
  current: (organizationId: string, userId: string) => readonly ['session', 'current', string, string];
}

export const sessionKeys: SessionKeysValue = {
  all: ['session'],
  current: (organizationId, userId) => ['session', 'current', organizationId, userId],
};
