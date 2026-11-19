import type { YardDispatchOptions } from '@skladburg/contracts/wms/v1/receiving';

export type YardDispatchActionValue = 'assign' | 'promote';

interface YardDispatchDraftStatusValue {
  canSubmit: boolean;
  hasConflict: boolean;
}

export const readYardDispatchDraft = (
  action: YardDispatchActionValue,
  expectedVersion: number,
  currentVersion: number | undefined,
  unloadingPointId: string,
  options: Pick<YardDispatchOptions, 'assignableUnloadingPointIds' | 'canPromote'> | undefined,
): YardDispatchDraftStatusValue => {
  const hasVersionConflict = currentVersion !== undefined && currentVersion !== expectedVersion;
  if (hasVersionConflict || options === undefined) {
    return { canSubmit: false, hasConflict: hasVersionConflict };
  }

  if (action === 'promote') {
    return { canSubmit: options.canPromote, hasConflict: !options.canPromote };
  }

  const canSubmit = options.assignableUnloadingPointIds.includes(unloadingPointId);
  return { canSubmit, hasConflict: unloadingPointId !== '' && !canSubmit };
};
