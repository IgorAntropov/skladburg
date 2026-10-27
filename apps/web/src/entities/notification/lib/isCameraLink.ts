import type { ObjectLink } from '@skladburg/contracts/common/v1/object_link';

import { ObjectKind } from '@skladburg/contracts/common/v1/object_link';

export const isCameraLink = (link: ObjectLink): boolean => {
  return link.cameraFocus !== undefined && link.cameraFocus.kind !== ObjectKind.UNSPECIFIED;
};
