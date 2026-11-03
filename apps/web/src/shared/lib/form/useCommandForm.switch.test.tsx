import type { ReactElement } from 'react';

import { QueryClientProvider } from '@tanstack/react-query';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { createQueryClient } from '@/shared/api';
import { withTestLocalizer } from '@/shared/i18n/index.testing';
import {
  LiveRegionProvider,
  SwitchField,
} from '@/shared/ui';

import { useCommandForm } from './useCommandForm';

interface SwitchFormProps {
  defaultValue: boolean;
  execute: (values: SwitchFormValues) => Promise<string>;
}

interface SwitchFormValues {
  isAutoConfirm: boolean;
}

const FIELD_LABEL = 'Auto confirm';
const SUBMIT_LABEL = 'Save';
const SET_ON_LABEL = 'Set on';

const SWITCH_RULES = {
  fields: {
    isAutoConfirm: { kind: 'opaque', protoName: 'is_auto_confirm' },
  },
} as const;

const SwitchForm = ({ defaultValue, execute }: SwitchFormProps): ReactElement => {
  const { getFieldProps, handleSubmit, setFieldValue } = useCommandForm<SwitchFormValues, string>({
    defaultValues: { isAutoConfirm: defaultValue },
    execute: values => execute(values),
    rules: SWITCH_RULES,
  });
  const { error, name, onBlur, onChange, ref } = getFieldProps('isAutoConfirm');

  const handleSetOnClick = (): void => {
    setFieldValue('isAutoConfirm', true);
  };

  return (
    <form noValidate onSubmit={handleSubmit}>
      <SwitchField
        error={error}
        label={FIELD_LABEL}
        name={name}
        onBlur={onBlur}
        onChange={onChange}
        ref={ref}
      />
      <button type="submit">{SUBMIT_LABEL}</button>
      <button onClick={handleSetOnClick} type="button">{SET_ON_LABEL}</button>
    </form>
  );
};

const renderForm = (props: SwitchFormProps): void => {
  render(withTestLocalizer(
    <LiveRegionProvider>
      <QueryClientProvider client={createQueryClient({ networkMode: 'always' })}>
        <SwitchForm {...props} />
      </QueryClientProvider>
    </LiveRegionProvider>,
  ));
};

const readSwitch = (): HTMLInputElement => {
  const element = screen.getByRole('switch', { name: new RegExp(FIELD_LABEL) });

  if (!(element instanceof HTMLInputElement)) {
    throw new TypeError('The switch is not an input');
  }

  return element;
};

describe('useCommandForm with SwitchField', () => {
  afterEach(() => {
    cleanup();
  });

  it('is a native checkbox with the switch role so that Space toggles it in the browser', () => {
    renderForm({ defaultValue: false, execute: vi.fn() });

    expect(readSwitch().type).toBe('checkbox');
  });

  it('shows the default value of the form', () => {
    renderForm({ defaultValue: true, execute: vi.fn() });

    expect(readSwitch().checked).toBe(true);
    expect(screen.getByRole('switch', { checked: true })).toBe(readSwitch());
  });

  it('submits false when the switch was not touched', async () => {
    const execute = vi.fn(() => Promise.resolve('saved'));

    renderForm({ defaultValue: false, execute });
    fireEvent.click(screen.getByText(SUBMIT_LABEL));

    await waitFor(() => {
      expect(execute).toHaveBeenCalledWith({ isAutoConfirm: false });
    });
  });

  it('submits true after the click and false after the second one', async () => {
    const execute = vi.fn(() => Promise.resolve('saved'));

    renderForm({ defaultValue: false, execute });
    fireEvent.click(readSwitch());

    expect(readSwitch().checked).toBe(true);

    fireEvent.click(screen.getByText(SUBMIT_LABEL));

    await waitFor(() => {
      expect(execute).toHaveBeenLastCalledWith({ isAutoConfirm: true });
    });

    fireEvent.click(readSwitch());

    expect(readSwitch().checked).toBe(false);

    fireEvent.click(screen.getByText(SUBMIT_LABEL));

    await waitFor(() => {
      expect(execute).toHaveBeenLastCalledWith({ isAutoConfirm: false });
    });
  });

  it('follows the value set by the form', async () => {
    const execute = vi.fn(() => Promise.resolve('saved'));

    renderForm({ defaultValue: false, execute });
    fireEvent.click(screen.getByText(SET_ON_LABEL));

    expect(readSwitch().checked).toBe(true);

    fireEvent.click(screen.getByText(SUBMIT_LABEL));

    await waitFor(() => {
      expect(execute).toHaveBeenCalledWith({ isAutoConfirm: true });
    });
  });

  it('ignores the click while the form is read-only', () => {
    const onChange = vi.fn();

    render(withTestLocalizer(<SwitchField isReadOnly label={FIELD_LABEL} name="isAutoConfirm" onChange={onChange} />));
    fireEvent.click(readSwitch());

    expect(readSwitch().checked).toBe(false);
    expect(onChange).not.toHaveBeenCalled();
  });
});
