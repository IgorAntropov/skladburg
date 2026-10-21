import type { ObjectTypeValue } from '@/shared/routing';

import type { NetworkMapTargetValue } from '../model/networkSceneInteraction';

export const resolveNetworkSelectedTarget = (
  id: string | undefined,
  type: ObjectTypeValue | undefined,
): NetworkMapTargetValue | undefined => {
  if (id === undefined) {
    return undefined;
  }

  if (type === 'site' || type === 'city') {
    return { id, kind: type };
  }

  return undefined;
};
