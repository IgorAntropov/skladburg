import type { ReactElement } from 'react';

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

import { withTestLocalizer } from '@/shared/i18n/index.testing';

import { SelectField } from './SelectField';

const FIELD_LABEL = 'Side';
const ANY_LABEL = 'Any';
const FIRST_LABEL = 'First';
const SECOND_LABEL = 'Second';

interface FieldPropsValue {
  defaultValue?: string;
  onChange?: () => void;
  value?: string;
}

const renderField = (props: FieldPropsValue): ReactElement => withTestLocalizer(
  <SelectField label={FIELD_LABEL} name="side" {...props}>
    <option value="">{ANY_LABEL}</option>
    <option value="a">{FIRST_LABEL}</option>
    <option value="b">{SECOND_LABEL}</option>
  </SelectField>,
);

const readSelect = (): HTMLSelectElement => {
  const element = screen.getByRole('combobox');

  if (!(element instanceof HTMLSelectElement)) {
    throw new TypeError('The field is not a select');
  }

  return element;
};

describe('SelectField controlled value', () => {
  afterEach(() => {
    cleanup();
  });

  it('shows the value from the prop and follows its changes', () => {
    const { rerender } = render(renderField({ value: 'a' }));

    expect(readSelect().value).toBe('a');

    rerender(renderField({ value: 'b' }));

    expect(readSelect().value).toBe('b');

    rerender(renderField({ value: '' }));

    expect(readSelect().value).toBe('');
  });

  it('reports the change but keeps showing the prop value until the prop changes', () => {
    const onChange = vi.fn();
    const { rerender } = render(renderField({ onChange, value: 'a' }));

    fireEvent.change(readSelect(), { target: { value: 'b' } });

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(readSelect().value).toBe('a');

    rerender(renderField({ onChange, value: 'b' }));

    expect(readSelect().value).toBe('b');
  });

  it('prefers the controlled value over the default value', () => {
    render(renderField({ defaultValue: 'a', value: 'b' }));

    expect(readSelect().value).toBe('b');
  });

  it('keeps working with the default value when it is uncontrolled', () => {
    render(renderField({ defaultValue: 'b' }));

    expect(readSelect().value).toBe('b');

    fireEvent.change(readSelect(), { target: { value: 'a' } });

    expect(readSelect().value).toBe('a');
  });
});
