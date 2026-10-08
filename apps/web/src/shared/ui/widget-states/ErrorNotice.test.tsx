import type { MessageInitShape } from '@bufbuild/protobuf';

import { create } from '@bufbuild/protobuf';
import {
  Code,
  ConnectError,
} from '@connectrpc/connect';
import {
  ErrorCode,
  ErrorDetailSchema,
} from '@skladburg/contracts/common/v1/error';
import {
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import { defaultLocaleCatalog } from 'virtual:build-profile';
import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { withLocalizer } from '../testing/withLocalizer';
import { ErrorNotice } from './ErrorNotice';

type ErrorDetailInitValue = MessageInitShape<typeof ErrorDetailSchema>;

const createFailure = (): Error => new Error('failure');

const createCodedFailure = (code: ErrorCode, params?: ErrorDetailInitValue['params']): ConnectError => new ConnectError(
  'failed',
  Code.FailedPrecondition,
  undefined,
  [{ desc: ErrorDetailSchema, value: create(ErrorDetailSchema, { code, params }) }],
);

describe('ErrorNotice', () => {
  afterEach(() => {
    cleanup();
  });

  it('announces the text of the error code in an alert', () => {
    render(withLocalizer(<ErrorNotice error={createFailure()} />));

    expect(screen.getByRole('alert').textContent).toBe(defaultLocaleCatalog['error.internal']);
  });

  it('shows the text of the code of the error and not its message', () => {
    render(withLocalizer(<ErrorNotice error={createCodedFailure(ErrorCode.VERSION_CONFLICT)} />));

    expect(screen.getByRole('alert').textContent).toBe(defaultLocaleCatalog['error.version_conflict']);
  });

  it('puts the denied permission of the error into the text', () => {
    const error = createCodedFailure(ErrorCode.PERMISSION_DENIED, {
      case: 'permissionDenied',
      value: { permission: 'deal_approve' },
    });
    render(withLocalizer(<ErrorNotice error={error} />));

    expect(screen.getByRole('alert').textContent).toContain('deal_approve');
  });

  it('has no retry button without a retry handler', () => {
    render(withLocalizer(<ErrorNotice error={createFailure()} />));

    expect(screen.queryByRole('button')).toBeNull();
  });

  it('calls the retry handler once per click', () => {
    const onRetry = vi.fn();
    render(withLocalizer(<ErrorNotice error={createFailure()} onRetry={onRetry} />));

    fireEvent.click(screen.getByRole('button', { name: defaultLocaleCatalog['common.retry'] }));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('shows the retrying state and ignores clicks while retrying', () => {
    const onRetry = vi.fn();
    render(withLocalizer(<ErrorNotice error={createFailure()} isRetrying onRetry={onRetry} />));
    const button = screen.getByRole('button', { name: defaultLocaleCatalog['common.retrying'] });

    fireEvent.click(button);

    expect(button.getAttribute('aria-busy')).toBe('true');
    expect(onRetry).not.toHaveBeenCalled();
  });

  it('replaces the alert node when the announce key changes, so the same text is announced again', () => {
    const error = createFailure();
    const { rerender } = render(withLocalizer(<ErrorNotice announceKey={1} error={error} />));
    const first = screen.getByRole('alert');

    rerender(withLocalizer(<ErrorNotice announceKey={2} error={error} />));
    const second = screen.getByRole('alert');

    expect(second.textContent).toBe(first.textContent);
    expect(second).not.toBe(first);
  });

  it('keeps the alert node while the announce key stays the same', () => {
    const error = createFailure();
    const { rerender } = render(withLocalizer(<ErrorNotice announceKey={1} error={error} />));
    const first = screen.getByRole('alert');

    rerender(withLocalizer(<ErrorNotice announceKey={1} error={error} isRetrying />));

    expect(screen.getByRole('alert')).toBe(first);
  });
});
