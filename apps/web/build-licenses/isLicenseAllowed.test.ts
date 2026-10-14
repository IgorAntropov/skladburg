import {
  describe,
  expect,
  it,
} from 'vitest';

import { isLicenseAllowed } from './isLicenseAllowed.ts';

const ALLOWED = ['MIT', 'ISC', 'Apache-2.0', 'BSD-3-Clause'];

describe('isLicenseAllowed', () => {
  it('allows a single allowed identifier', () => {
    expect(isLicenseAllowed('MIT', ALLOWED)).toBe(true);
    expect(isLicenseAllowed('Apache-2.0', ALLOWED)).toBe(true);
  });

  it('rejects an identifier outside the allowed list', () => {
    expect(isLicenseAllowed('MPL-2.0', ALLOWED)).toBe(false);
    expect(isLicenseAllowed('GPL-3.0', ALLOWED)).toBe(false);
    expect(isLicenseAllowed('UNLICENSED', ALLOWED)).toBe(false);
  });

  it('requires every operand of AND to be allowed', () => {
    expect(isLicenseAllowed('(Apache-2.0 AND BSD-3-Clause)', ALLOWED)).toBe(true);
    expect(isLicenseAllowed('GPL-3.0 AND MIT', ALLOWED)).toBe(false);
    expect(isLicenseAllowed('MIT AND ISC AND MPL-2.0', ALLOWED)).toBe(false);
  });

  it('requires at least one operand of OR to be allowed', () => {
    expect(isLicenseAllowed('(MIT OR GPL-3.0)', ALLOWED)).toBe(true);
    expect(isLicenseAllowed('GPL-3.0 OR MIT', ALLOWED)).toBe(true);
    expect(isLicenseAllowed('GPL-3.0 OR MPL-2.0', ALLOWED)).toBe(false);
  });

  it('binds AND tighter than OR and honours parentheses', () => {
    expect(isLicenseAllowed('MIT OR GPL-3.0 AND MPL-2.0', ALLOWED)).toBe(true);
    expect(isLicenseAllowed('GPL-3.0 AND MPL-2.0 OR MIT', ALLOWED)).toBe(true);
    expect(isLicenseAllowed('(MIT OR GPL-3.0) AND MPL-2.0', ALLOWED)).toBe(false);
    expect(isLicenseAllowed('MIT AND (GPL-3.0 OR ISC)', ALLOWED)).toBe(true);
  });

  it('accepts operators in any letter case', () => {
    expect(isLicenseAllowed('MIT or GPL-3.0', ALLOWED)).toBe(true);
    expect(isLicenseAllowed('MIT and GPL-3.0', ALLOWED)).toBe(false);
  });

  it('does not allow an exception clause', () => {
    expect(isLicenseAllowed('Apache-2.0 WITH LLVM-exception', ALLOWED)).toBe(false);
    expect(isLicenseAllowed('MIT OR Apache-2.0 WITH LLVM-exception', ALLOWED)).toBe(true);
  });

  it('rejects malformed expressions', () => {
    expect(isLicenseAllowed('', ALLOWED)).toBe(false);
    expect(isLicenseAllowed('   ', ALLOWED)).toBe(false);
    expect(isLicenseAllowed('MIT AND', ALLOWED)).toBe(false);
    expect(isLicenseAllowed('OR MIT', ALLOWED)).toBe(false);
    expect(isLicenseAllowed('(MIT', ALLOWED)).toBe(false);
    expect(isLicenseAllowed('MIT)', ALLOWED)).toBe(false);
    expect(isLicenseAllowed('MIT ISC', ALLOWED)).toBe(false);
    expect(isLicenseAllowed('()', ALLOWED)).toBe(false);
    expect(isLicenseAllowed('MIT WITH', ALLOWED)).toBe(false);
  });

  it('does not allow anything when the allowed list is empty', () => {
    expect(isLicenseAllowed('MIT', [])).toBe(false);
  });
});
