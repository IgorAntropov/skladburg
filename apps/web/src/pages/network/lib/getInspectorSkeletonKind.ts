import type { ObjectTypeValue } from '@/shared/routing';

export type InspectorSkeletonKindValue = 'city' | 'organization' | 'site';

export const getInspectorSkeletonKind = (type: ObjectTypeValue): InspectorSkeletonKindValue => {
  if (type === 'city' || type === 'organization') {
    return type;
  }

  return 'site';
};
