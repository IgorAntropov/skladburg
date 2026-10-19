import type { GetSessionResponse } from '@skladburg/contracts/access/v1/access';

import type { AppSectionValue } from '@/shared/routing';

import { APP_SECTIONS } from '@/shared/routing';

import { SECTION_ACCESS_RULES } from '../model/sectionAccessRules';
import { isPermissionGranted } from './isPermissionGranted';

export const resolveAvailableSections = (session: GetSessionResponse): readonly AppSectionValue[] =>
  APP_SECTIONS.filter(section => SECTION_ACCESS_RULES[section].permissions.some(
    code => isPermissionGranted(session.permissions, code, { kind: 'any' }),
  ));
