import { validateFormValues } from '@skladburg/contracts/forms';
import { SupportTicketContextFormRules } from '@skladburg/contracts/forms/support/v1/support_ticket';
import {
  describe,
  expect,
  it,
} from 'vitest';

import { resolveAppVersion } from './resolveAppVersion.ts';

const resolveWith = (output: string): string => resolveAppVersion({ readGitHead: () => output });

describe('resolveAppVersion', () => {
  it('returns the short hash in lower case without the line break', () => {
    expect(resolveWith('A1B2C3D\n')).toBe('a1b2c3d');
    expect(resolveWith('c9ee506')).toBe('c9ee506');
    expect(resolveWith(`${'a'.repeat(40)}\n`)).toBe('a'.repeat(40));
  });

  it('falls back to dev when git is missing or fails', () => {
    const readGitHead = (): string => {
      throw new Error('git: command not found');
    };

    expect(resolveAppVersion({ readGitHead })).toBe('dev');
  });

  it.each([
    '',
    '\n',
    'c9ee50',
    'c9ee506-dirty',
    'c9ee506+dirty',
    'fatal: not a git repository',
    'HEAD',
    'g9ee506',
    'a'.repeat(41),
  ])('falls back to dev for the output %j', (output) => {
    expect(resolveWith(output)).toBe('dev');
  });

  it('produces a value accepted by the app_version rule of the contract', () => {
    for (const output of ['c9ee506\n', 'A1B2C3D4E', '', 'oops']) {
      const appVersion = resolveWith(output);

      expect(validateFormValues(SupportTicketContextFormRules, { appVersion }, ['appVersion'])).toEqual([]);
    }
  });
});
