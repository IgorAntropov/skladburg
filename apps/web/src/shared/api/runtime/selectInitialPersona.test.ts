import {
  describe,
  expect,
  it,
} from 'vitest';

import type { DemoPersonaListItemValue } from '../transport/demo';

import { DemoPersonaGroup } from '../transport/demo/demoPersonaGroup';
import { DemoPersonaKind } from '../transport/demo/demoPersonaKind';
import { selectInitialPersona } from './selectInitialPersona';

const createPersona = (id: string, organizationId: string, userId = `user-of-${id}`): DemoPersonaListItemValue => ({
  group: DemoPersonaGroup.FRESH,
  id,
  kind: DemoPersonaKind.CUSTOMER,
  organizationId,
  organizationName: `Organization ${organizationId}`,
  roleName: 'Administrator',
  userDisplayName: `User ${userId}`,
  userId,
});

const NO_PREFERENCE = { preferredContext: undefined, preferredPersonaId: undefined };

describe('selectInitialPersona', () => {
  describe('persona of the profile organization', () => {
    it('returns the persona with the smallest id in the organization', () => {
      const personas = [
        createPersona('persona-c', 'org-1'),
        createPersona('persona-a', 'org-1'),
        createPersona('persona-b', 'org-1'),
      ];

      expect(selectInitialPersona(personas, { ...NO_PREFERENCE, defaultOrganizationId: 'org-1' })?.id).toBe('persona-a');
    });

    it('does not depend on the order of the list', () => {
      const personas = [createPersona('persona-a', 'org-1'), createPersona('persona-b', 'org-1')];

      expect(selectInitialPersona(personas.toReversed(), { ...NO_PREFERENCE, defaultOrganizationId: 'org-1' })?.id)
        .toBe('persona-a');
    });

    it('ignores personas of other organizations', () => {
      const personas = [createPersona('persona-a', 'org-2'), createPersona('persona-z', 'org-1')];

      expect(selectInitialPersona(personas, { ...NO_PREFERENCE, defaultOrganizationId: 'org-1' })?.id).toBe('persona-z');
    });

    it('compares ids by code units', () => {
      const personas = [createPersona('a', 'org-1'), createPersona('B', 'org-1')];

      expect(selectInitialPersona(personas, { ...NO_PREFERENCE, defaultOrganizationId: 'org-1' })?.id).toBe('B');
    });
  });

  describe('preferred persona id', () => {
    it('wins over the preferred context and the profile organization', () => {
      const personas = [
        createPersona('persona-a', 'org-1'),
        createPersona('persona-b', 'org-2'),
        createPersona('persona-c', 'org-3'),
      ];

      const selected = selectInitialPersona(personas, {
        defaultOrganizationId: 'org-1',
        preferredContext: { organizationId: 'org-3', userId: 'user-of-persona-c' },
        preferredPersonaId: 'persona-b',
      });

      expect(selected?.id).toBe('persona-b');
    });

    it('is skipped silently when no persona has this id', () => {
      const personas = [createPersona('persona-a', 'org-1'), createPersona('persona-b', 'org-2')];

      const selected = selectInitialPersona(personas, {
        defaultOrganizationId: 'org-1',
        preferredContext: { organizationId: 'org-2', userId: 'user-of-persona-b' },
        preferredPersonaId: 'persona-unknown',
      });

      expect(selected?.id).toBe('persona-b');
    });

    it('falls back to the profile organization when the id is unknown and there is no preferred context', () => {
      const personas = [createPersona('persona-a', 'org-1'), createPersona('persona-b', 'org-2')];

      const selected = selectInitialPersona(personas, {
        defaultOrganizationId: 'org-1',
        preferredContext: undefined,
        preferredPersonaId: 'persona-unknown',
      });

      expect(selected?.id).toBe('persona-a');
    });
  });

  describe('preferred context', () => {
    it('picks the persona with the same organization and user', () => {
      const personas = [
        createPersona('persona-a', 'org-1', 'user-1'),
        createPersona('persona-b', 'org-1', 'user-2'),
      ];

      const selected = selectInitialPersona(personas, {
        defaultOrganizationId: 'org-1',
        preferredContext: { organizationId: 'org-1', userId: 'user-2' },
        preferredPersonaId: undefined,
      });

      expect(selected?.id).toBe('persona-b');
    });

    it('requires both the organization and the user to match', () => {
      const personas = [
        createPersona('persona-a', 'org-1', 'user-1'),
        createPersona('persona-b', 'org-2', 'user-2'),
      ];

      const selected = selectInitialPersona(personas, {
        defaultOrganizationId: 'org-1',
        preferredContext: { organizationId: 'org-2', userId: 'user-1' },
        preferredPersonaId: undefined,
      });

      expect(selected?.id).toBe('persona-a');
    });

    it('is skipped when the context is incomplete', () => {
      const personas = [createPersona('persona-a', 'org-1', 'user-1'), createPersona('persona-b', 'org-2', 'user-2')];

      const selected = selectInitialPersona(personas, {
        defaultOrganizationId: 'org-2',
        preferredContext: { organizationId: 'org-1', userId: undefined },
        preferredPersonaId: undefined,
      });

      expect(selected?.id).toBe('persona-b');
    });
  });

  describe('nothing found', () => {
    it('returns undefined when the organization has no persona and there is no preference', () => {
      expect(selectInitialPersona(
        [createPersona('persona-a', 'org-2')],
        { ...NO_PREFERENCE, defaultOrganizationId: 'org-1' },
      )).toBeUndefined();
    });

    it('returns undefined for an empty list even with preferences', () => {
      expect(selectInitialPersona([], {
        defaultOrganizationId: 'org-1',
        preferredContext: { organizationId: 'org-1', userId: 'user-1' },
        preferredPersonaId: 'persona-a',
      })).toBeUndefined();
    });
  });
});
