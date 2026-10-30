import type { ReactElement } from 'react';

import { SaveSignatoryRequestFormRules } from '@skladburg/contracts/forms/organization/v1/requisites';
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
} from 'vitest';

import { createQueryClient } from '@/shared/api';
import { withTestLocalizer } from '@/shared/i18n/index.testing';
import { LiveRegionProvider } from '@/shared/ui';

import { useCommandForm } from './useCommandForm';

interface SignatoryInputValue {
  signatory: { fullName: string; position: string };
}

const INITIAL_NAME = 'Тестов Тест Тестович';
const OTHER_NAME = 'Образцов Образец Образцович';

const StateForm = (): ReactElement => {
  const {
    getFieldProps,
    handleSubmit,
    isDirty,
    setFieldValue,
    watchField,
  } = useCommandForm<SignatoryInputValue, string>({
    defaultValues: { signatory: { fullName: INITIAL_NAME, position: 'Директор' } },
    execute: () => Promise.resolve('saved'),
    rules: SaveSignatoryRequestFormRules,
    watchedFields: ['signatory.fullName'],
  });
  const { error, name, onBlur, onChange, ref } = getFieldProps('signatory.fullName');

  const handleSetNameClick = (): void => {
    setFieldValue('signatory.fullName', OTHER_NAME);
  };

  return (
    <form data-testid="form" onSubmit={handleSubmit}>
      <input data-testid="full-name" name={name} onBlur={onBlur} onChange={onChange} ref={ref} />
      <button data-testid="set-name" onClick={handleSetNameClick} type="button" />
      <p data-testid="is-dirty">{String(isDirty)}</p>
      <p data-testid="error">{error ?? ''}</p>
      <p data-testid="watched">{watchField('signatory.fullName')}</p>
    </form>
  );
};

const renderForm = (): void => {
  render(withTestLocalizer(
    <LiveRegionProvider>
      <QueryClientProvider client={createQueryClient({ networkMode: 'always' })}>
        <StateForm />
      </QueryClientProvider>
    </LiveRegionProvider>,
  ));
};

const typeFullName = (value: string): void => {
  fireEvent.change(screen.getByTestId('full-name'), { target: { value } });
};

describe('useCommandForm state', () => {
  afterEach(() => {
    cleanup();
  });

  it('is not dirty until a value differs from the defaults and is not dirty again after the value returns', () => {
    renderForm();

    expect(screen.getByTestId('is-dirty').textContent).toBe('false');

    typeFullName(OTHER_NAME);

    expect(screen.getByTestId('is-dirty').textContent).toBe('true');

    typeFullName(INITIAL_NAME);

    expect(screen.getByTestId('is-dirty').textContent).toBe('false');
  });

  it('gives the current value of a nested field and follows its changes', () => {
    renderForm();

    expect(screen.getByTestId('watched').textContent).toBe(INITIAL_NAME);

    typeFullName(OTHER_NAME);

    expect(screen.getByTestId('watched').textContent).toBe(OTHER_NAME);
  });

  it('takes the saved values as the new defaults after a successful save', async () => {
    renderForm();
    typeFullName(OTHER_NAME);

    fireEvent.submit(screen.getByTestId('form'));

    await waitFor(() => {
      expect(screen.getByTestId('is-dirty').textContent).toBe('false');
    });
    expect(screen.getByTestId('watched').textContent).toBe(OTHER_NAME);

    typeFullName(INITIAL_NAME);

    expect(screen.getByTestId('is-dirty').textContent).toBe('true');
  });

  it('sets a value, marks the form dirty and removes the error of that field', async () => {
    renderForm();
    typeFullName('');

    fireEvent.submit(screen.getByTestId('form'));

    await waitFor(() => {
      expect(screen.getByTestId('error').textContent).not.toBe('');
    });

    fireEvent.click(screen.getByTestId('set-name'));

    await waitFor(() => {
      expect(screen.getByTestId('error').textContent).toBe('');
    });
    expect(screen.getByTestId('watched').textContent).toBe(OTHER_NAME);
    expect(screen.getByTestId('is-dirty').textContent).toBe('true');
  });
});
