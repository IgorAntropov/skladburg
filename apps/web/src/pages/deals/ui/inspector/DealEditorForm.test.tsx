import type { ReactElement } from 'react';

import { ErrorCode } from '@skladburg/contracts/common/v1/error';
import {
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import type { CommandValue } from '@/shared/api';

import { withTestLocalizer } from '@/shared/i18n/index.testing';
import { RoutingProvider } from '@/shared/routing';
import { createMemoryLocation } from '@/shared/routing/index.testing';

import { DealEditorForm } from './DealEditorForm';

const FORM_LABEL = 'Form';
const FIELD_LABEL = 'Reason';

const createCommand = (hasConflict: boolean): CommandValue => ({
  apiError: hasConflict
    ? { code: ErrorCode.VERSION_CONFLICT, isRetryable: false, params: { case: undefined }, traceId: undefined }
    : undefined,
  error: hasConflict ? new Error('Version conflict') : null,
  failedAt: 0,
  isPending: false,
  method: undefined,
  reset: vi.fn(),
  run: vi.fn(),
});

describe('DealEditorForm', () => {
  afterEach(cleanup);

  it('keeps input and requires a fresh reviewed version after a conflict even when the field change clears the RPC error', () => {
    const location = createMemoryLocation('/deals');
    const onRefresh = vi.fn();
    const onSubmit = vi.fn();

    const content = (version: number, hasConflict: boolean): ReactElement => withTestLocalizer(
      <RoutingProvider location={location}>
        <DealEditorForm
          access={{ status: 'allowed' }}
          command={createCommand(hasConflict)}
          formTestId="deal-test-form"
          isCurrentAction
          isDirty
          label={FORM_LABEL}
          onClose={vi.fn()}
          onRefresh={onRefresh}
          onSubmit={onSubmit}
          t={(key, ..._params) => key}
          version={version}
        >
          <input aria-label={FIELD_LABEL} defaultValue="My reason" />
        </DealEditorForm>
      </RoutingProvider>,
    );

    const { rerender } = render(content(1, true));
    const field = screen.getByRole('textbox', { name: FIELD_LABEL });

    expect(onRefresh).toHaveBeenCalledTimes(1);
    fireEvent.change(field, { target: { value: 'Edited reason' } });
    rerender(content(1, false));
    fireEvent.submit(screen.getByTestId('deal-test-form'));
    expect(onSubmit).not.toHaveBeenCalled();

    rerender(content(2, false));
    expect(field).toHaveProperty('value', 'Edited reason');
    fireEvent.submit(screen.getByTestId('deal-test-form'));
    expect(onSubmit).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'dealInspector.versionReview' }));
    fireEvent.submit(screen.getByTestId('deal-test-form'));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });
});
