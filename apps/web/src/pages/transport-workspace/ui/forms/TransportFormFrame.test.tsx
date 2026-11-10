import type { ReactElement } from 'react';
import type { Mock } from 'vitest';

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

import { TransportFormFrame } from './TransportFormFrame';

vi.mock('@/entities/session', () => ({ useCommandAccess: () => ({ status: 'allowed' }) }));

const FORM_TEST_ID = 'transport-test-form';
const SUBMIT_TEST_ID = 'transport-test-submit';
const FIELD_LABEL = 'Время выезда';
const FORM_TITLE = 'Назначение на рейс';

const createHarness = (): {
  content: (version: number, command: CommandValue) => ReactElement;
  onRefresh: Mock<() => Promise<void>>;
  onSubmit: Mock;
} => {
  const location = createMemoryLocation('/transport');
  const onRefresh = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
  const onSubmit = vi.fn();

  const content = (version: number, command: CommandValue): ReactElement => withTestLocalizer(
    <RoutingProvider location={location}>
      <TransportFormFrame
        command={command}
        formTestId={FORM_TEST_ID}
        isCurrentAction
        isDirty
        onClose={vi.fn()}
        onRefresh={onRefresh}
        onSubmit={onSubmit}
        submitLabel="Сохранить назначение"
        submitTestId={SUBMIT_TEST_ID}
        t={(key, ..._params) => key}
        title={FORM_TITLE}
        version={version}
      >
        <input aria-label={FIELD_LABEL} defaultValue="09:00" />
      </TransportFormFrame>
    </RoutingProvider>,
  );

  return { content, onRefresh, onSubmit };
};

const createCommand = (): CommandValue => ({
  apiError: undefined,
  error: null,
  failedAt: 0,
  isPending: false,
  method: undefined,
  reset: vi.fn(),
  run: vi.fn(),
});

describe('TransportFormFrame', () => {
  afterEach(cleanup);

  it('keeps the edited input and blocks submission until a fresh version is reviewed', () => {
    const { content, onRefresh, onSubmit } = createHarness();
    const command = createCommand();
    const conflictCommand: CommandValue = {
      ...command,
      apiError: { code: ErrorCode.VERSION_CONFLICT, isRetryable: false, params: { case: undefined }, traceId: undefined },
      error: new Error('Version conflict'),
      failedAt: 1,
    };

    const { rerender } = render(content(1, conflictCommand));
    const field = screen.getByRole('textbox', { name: FIELD_LABEL });
    const form = screen.getByTestId(FORM_TEST_ID);
    const submit = screen.getByTestId(SUBMIT_TEST_ID);

    expect(onRefresh).toHaveBeenCalledTimes(1);
    expect(submit.getAttribute('aria-disabled')).toBe('true');

    fireEvent.change(field, { target: { value: '09:30' } });
    rerender(content(1, command));
    fireEvent.submit(form);
    expect(onSubmit).not.toHaveBeenCalled();

    rerender(content(2, command));
    expect(field).toHaveProperty('value', '09:30');
    fireEvent.submit(form);
    expect(onSubmit).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'transport.form.review' }));
    expect(command.reset).toHaveBeenCalledTimes(1);
    expect(submit.getAttribute('aria-disabled')).toBeNull();
    fireEvent.submit(form);
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('blocks submission during a command and when the version changes before a new submission', () => {
    const { content, onSubmit } = createHarness();
    const command = createCommand();
    const { rerender } = render(content(1, { ...command, isPending: true }));
    const form = screen.getByTestId(FORM_TEST_ID);

    fireEvent.submit(form);
    expect(onSubmit).not.toHaveBeenCalled();

    rerender(content(1, command));
    fireEvent.submit(form);
    expect(onSubmit).toHaveBeenCalledTimes(1);

    rerender(content(2, command));
    fireEvent.submit(form);
    expect(onSubmit).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'transport.form.review' }));
    fireEvent.submit(form);
    expect(onSubmit).toHaveBeenCalledTimes(2);
  });
});
