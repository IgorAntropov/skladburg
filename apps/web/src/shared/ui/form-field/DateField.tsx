import type {
  ChangeEventHandler,
  FocusEventHandler,
  ReactElement,
  Ref,
} from 'react';

import { useId } from 'react';

import { cn } from '@/shared/lib/cn';

import { FieldFrame } from './FieldFrame';
import {
  FIELD_CONTROL_SIZE_CLASS_NAME,
  getFieldBorderClassName,
} from './fieldStyles';
import {
  FIELD_SURFACE_CLASS_NAME,
  FIELD_TEXT_CLASS_NAME,
} from './fieldSurfaceStyles';

const CONTROL_CLASS_NAME = [
  FIELD_SURFACE_CLASS_NAME,
  FIELD_TEXT_CLASS_NAME,
  FIELD_CONTROL_SIZE_CLASS_NAME,
  'block px-3 text-start',
  '[&::-webkit-datetime-edit]:p-0',
  '[&::-webkit-date-and-time-value]:m-0 [&::-webkit-date-and-time-value]:min-h-6 [&::-webkit-date-and-time-value]:text-start',
].join(' ');

const READ_ONLY_CLASS_NAME = 'pointer-events-none';

const LABEL_RAISED_CLASS_NAME = 'max-w-[calc((100%-1.5rem)/0.75)] translate-y-1.5 scale-75';

export interface DateFieldProps {
  error?: string | undefined;
  hint?: string | undefined;
  isOptional?: boolean | undefined;
  isReadOnly?: boolean | undefined;
  label: string;
  max?: string | undefined;
  min?: string | undefined;
  name: string;
  onBlur?: FocusEventHandler<HTMLInputElement> | undefined;
  onChange?: ChangeEventHandler<HTMLInputElement> | undefined;
  ref?: Ref<HTMLInputElement> | undefined;
}

export const DateField = ({
  error,
  hint,
  isOptional = false,
  isReadOnly = false,
  label,
  max,
  min,
  name,
  onBlur,
  onChange,
  ref,
}: DateFieldProps): ReactElement => {
  const controlId = useId();
  const messageId = `${controlId}-message`;

  const isInvalid = error !== undefined;
  const isMessageShown = isInvalid || hint !== undefined;
  const borderClassName = getFieldBorderClassName({ isInvalid, isReadOnly });

  return (
    <FieldFrame
      controlId={controlId}
      error={error}
      hint={hint}
      isOptional={isOptional}
      label={label}
      labelRaisedClassName={LABEL_RAISED_CLASS_NAME}
      messageId={messageId}
    >
      <input
        aria-describedby={isMessageShown ? messageId : undefined}
        aria-invalid={isInvalid ? true : undefined}
        className={cn(CONTROL_CLASS_NAME, borderClassName, isReadOnly && READ_ONLY_CLASS_NAME)}
        id={controlId}
        max={max}
        min={min}
        name={name}
        onBlur={onBlur}
        onChange={onChange}
        readOnly={isReadOnly}
        ref={ref}
        type="date"
      />
    </FieldFrame>
  );
};
