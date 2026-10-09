interface WorldClockKeysValue {
  all: readonly ['world-clock'];
  current: () => readonly ['world-clock', 'current'];
}

export const worldClockKeys: WorldClockKeysValue = {
  all: ['world-clock'],
  current: () => ['world-clock', 'current'],
};
