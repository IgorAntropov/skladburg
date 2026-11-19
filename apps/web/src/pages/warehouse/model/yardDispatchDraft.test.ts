import {
  expect,
  it,
} from 'vitest';

import { readYardDispatchDraft } from './yardDispatchDraft';

it('keeps a version-changed or no longer assignable dock selection blocked until review', () => {
  const assignable = { assignableUnloadingPointIds: ['dock-2'], canPromote: true };
  expect(readYardDispatchDraft('assign', 3, 4, 'dock-2', assignable)).toEqual({ canSubmit: false, hasConflict: true });
  expect(readYardDispatchDraft('assign', 4, 4, 'dock-1', assignable)).toEqual({ canSubmit: false, hasConflict: true });
  expect(readYardDispatchDraft('assign', 4, 4, '', assignable)).toEqual({ canSubmit: false, hasConflict: false });
  expect(readYardDispatchDraft('assign', 4, 4, 'dock-2', assignable)).toEqual({ canSubmit: true, hasConflict: false });
});

it('holds submission during a partial snapshot and does not retry a spent promotion', () => {
  expect(readYardDispatchDraft('promote', 4, 4, '', undefined)).toEqual({ canSubmit: false, hasConflict: false });
  expect(readYardDispatchDraft('promote', 4, 4, '', { assignableUnloadingPointIds: [], canPromote: false }))
    .toEqual({ canSubmit: false, hasConflict: true });
  expect(readYardDispatchDraft('promote', 4, 4, '', { assignableUnloadingPointIds: [], canPromote: true }))
    .toEqual({ canSubmit: true, hasConflict: false });
});
