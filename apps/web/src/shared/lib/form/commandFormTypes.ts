import type { DescMethod } from '@bufbuild/protobuf';
import type {
  FieldCheckRunnerValue,
  FormRulesValue,
} from '@skladburg/contracts/forms';
import type {
  ChangeEventHandler,
  FocusEventHandler,
  InputEventHandler,
  RefCallback,
  SyntheticEvent,
} from 'react';
import type {
  DefaultValues,
  FieldValues,
  Path,
} from 'react-hook-form';

import type { CommandValue } from '@/shared/api';
import type { InputMaskValue } from '@/shared/lib/mask';

export interface CommandFormOptionsValue<TInput extends FieldValues, TResult, TOutput = TInput> {
  defaultValues: DefaultValues<TInput> & TInput;
  execute: (values: TOutput, idempotencyKey: string) => Promise<TResult>;
  method?: DescMethod | undefined;
  onSuccess?: ((result: TResult) => void) | undefined;
  rules: FormRulesValue;
  runCheck?: FieldCheckRunnerValue | undefined;
  translateViolation?: ((ruleId: string) => string | undefined) | undefined;
}

export interface CommandFormValue<TInput extends FieldValues> {
  command: CommandValue;
  getFieldProps: (name: Path<TInput>, options?: FormFieldOptionsValue) => FormFieldBindingValue;
  handleSubmit: (event: SyntheticEvent<HTMLFormElement>) => void;
  isRequired: (name: Path<TInput>) => boolean;
}

export interface FormFieldBindingValue {
  error: string | undefined;
  isOptional: boolean;
  isReadOnly: boolean;
  mask?: InputMaskValue | undefined;
  name: string;
  onBlur: FocusEventHandler<HTMLInputElement | HTMLSelectElement>;
  onChange: ChangeEventHandler<HTMLInputElement | HTMLSelectElement>;
  onInput?: InputEventHandler<HTMLInputElement | HTMLSelectElement> | undefined;
  ref: RefCallback<HTMLInputElement | HTMLSelectElement>;
}

export interface FormFieldOptionsValue {
  mask?: InputMaskValue | undefined;
}
