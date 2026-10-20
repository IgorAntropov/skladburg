import type { DescMethod } from '@bufbuild/protobuf';
import type { FormRulesValue } from '@skladburg/contracts/forms';
import type {
  ChangeEventHandler,
  FocusEventHandler,
  RefCallback,
  SyntheticEvent,
} from 'react';
import type {
  DefaultValues,
  FieldValues,
  Path,
} from 'react-hook-form';

import type { CommandValue } from '@/shared/api';

export interface CommandFormOptionsValue<TValues extends FieldValues, TResult> {
  defaultValues: DefaultValues<TValues> & TValues;
  execute: (values: TValues, idempotencyKey: string) => Promise<TResult>;
  method?: DescMethod | undefined;
  onSuccess?: ((result: TResult) => void) | undefined;
  rules: FormRulesValue;
}

export interface CommandFormValue<TValues extends FieldValues> {
  command: CommandValue;
  getFieldProps: (name: Path<TValues>) => FormFieldBindingValue;
  handleSubmit: (event: SyntheticEvent<HTMLFormElement>) => void;
  isRequired: (name: Path<TValues>) => boolean;
}

export interface FormFieldBindingValue {
  error: string | undefined;
  isOptional: boolean;
  isReadOnly: boolean;
  name: string;
  onBlur: FocusEventHandler<HTMLInputElement | HTMLSelectElement>;
  onChange: ChangeEventHandler<HTMLInputElement | HTMLSelectElement>;
  ref: RefCallback<HTMLInputElement | HTMLSelectElement>;
}
