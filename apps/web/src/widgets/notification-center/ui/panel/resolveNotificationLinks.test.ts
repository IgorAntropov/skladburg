import { create } from '@bufbuild/protobuf';
import {
  ObjectKind,
  ObjectLinkSchema,
  ObjectRefSchema,
} from '@skladburg/contracts/common/v1/object_link';
import {
  describe,
  expect,
  it,
} from 'vitest';

import { resolveNotificationLinks } from './resolveNotificationLinks';

const ORGANIZATION_ID = '00000000-0000-4000-8000-000000000001';
const FIRST_SITE_ID = '00000000-0000-4000-8000-000000000002';
const SECOND_SITE_ID = '00000000-0000-4000-8000-000000000003';

const createLink = (kind: ObjectKind, id: string, hasCamera: boolean): ReturnType<typeof create<typeof ObjectLinkSchema>> => {
  const ref = create(ObjectRefSchema, { id, kind });

  return create(ObjectLinkSchema, { cameraFocus: hasCamera ? ref : undefined, target: ref });
};

describe('resolveNotificationLinks', () => {
  it('labels the company link, then the first map link, and drops the rest', () => {
    const links = resolveNotificationLinks([
      createLink(ObjectKind.ORGANIZATION, ORGANIZATION_ID, true),
      createLink(ObjectKind.SITE, FIRST_SITE_ID, true),
      createLink(ObjectKind.SITE, SECOND_SITE_ID, true),
    ]);

    expect(links.map(link => link.labelKey)).toEqual(['notification.link.organization', 'notification.link.map']);
    expect(links[1]?.address).toEqual({ kind: 'object', object: { id: FIRST_SITE_ID, type: 'site' } });
  });

  it('asks the camera only for a link with a camera target', () => {
    const [withCamera, withoutCamera] = resolveNotificationLinks([
      createLink(ObjectKind.SITE, FIRST_SITE_ID, true),
      createLink(ObjectKind.DEAL, SECOND_SITE_ID, false),
    ]);

    expect(withCamera?.isFocusRequested).toBe(true);
    expect(withoutCamera?.labelKey).toBe('notification.link.open');
    expect(withoutCamera?.isFocusRequested).toBe(false);
  });

  it('skips a link without a target kind', () => {
    const links = resolveNotificationLinks([
      createLink(ObjectKind.UNSPECIFIED, FIRST_SITE_ID, false),
      createLink(ObjectKind.CITY, SECOND_SITE_ID, false),
    ]);

    expect(links.map(link => link.labelKey)).toEqual(['notification.link.open']);
  });

  it('returns nothing without links', () => {
    expect(resolveNotificationLinks([])).toEqual([]);
  });
});
