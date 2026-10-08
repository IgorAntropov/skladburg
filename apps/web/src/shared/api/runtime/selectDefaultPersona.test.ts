import {
  describe,
  expect,
  it,
} from 'vitest';

import type { DemoPersonaValue } from '../transport/demo';

import { selectDefaultPersona } from './selectDefaultPersona';

const createPersona = (id: string, organizationId: string): DemoPersonaValue => ({
  id,
  kind: 'buyer',
  organizationId,
  userId: `user-of-${id}`,
});

describe('selectDefaultPersona', () => {
  it('returns the persona with the smallest id in the organization', () => {
    const personas = [
      createPersona('persona-c', 'org-1'),
      createPersona('persona-a', 'org-1'),
      createPersona('persona-b', 'org-1'),
    ];

    expect(selectDefaultPersona(personas, 'org-1')?.id).toBe('persona-a');
  });

  it('does not depend on the order of the list', () => {
    const personas = [createPersona('persona-a', 'org-1'), createPersona('persona-b', 'org-1')];

    expect(selectDefaultPersona(personas.toReversed(), 'org-1')?.id).toBe('persona-a');
  });

  it('ignores personas of other organizations', () => {
    const personas = [createPersona('persona-a', 'org-2'), createPersona('persona-z', 'org-1')];

    expect(selectDefaultPersona(personas, 'org-1')?.id).toBe('persona-z');
  });

  it('compares ids by code units', () => {
    const personas = [createPersona('a', 'org-1'), createPersona('B', 'org-1')];

    expect(selectDefaultPersona(personas, 'org-1')?.id).toBe('B');
  });

  it('returns undefined when the organization has no persona', () => {
    expect(selectDefaultPersona([createPersona('persona-a', 'org-2')], 'org-1')).toBeUndefined();
  });

  it('returns undefined for an empty list', () => {
    expect(selectDefaultPersona([], 'org-1')).toBeUndefined();
  });
});
