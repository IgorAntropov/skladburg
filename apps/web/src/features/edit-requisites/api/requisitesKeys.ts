interface RequisitesKeysValue {
  all: readonly ['requisites'];
  detail: (scope: string) => readonly ['requisites', 'detail', string];
}

export const requisitesKeys: RequisitesKeysValue = {
  all: ['requisites'],
  detail: scope => ['requisites', 'detail', scope],
};
