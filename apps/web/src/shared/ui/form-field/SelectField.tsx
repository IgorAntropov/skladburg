import type {
  ChangeEvent,
  ChangeEventHandler,
  FocusEventHandler,
  MouseEvent,
  ReactElement,
  ReactNode,
  Ref,
} from 'react';

import { ChevronDown } from 'lucide-react';
import {
  useCallback,
  useEffect,
  useId,
  useRef,
} from 'react';

import { cn } from '@/shared/lib/cn';

import { FieldFrame } from './FieldFrame';
import {
  FIELD_AUTOFILL_CLASS_NAME,
  FIELD_CONTROL_SIZE_CLASS_NAME,
  getFieldBorderClassName,
} from './fieldStyles';
import { FIELD_SURFACE_CLASS_NAME } from './fieldSurfaceStyles';

const CONTROL_CLASS_NAME = [
  FIELD_SURFACE_CLASS_NAME,
  FIELD_CONTROL_SIZE_CLASS_NAME,
  FIELD_AUTOFILL_CLASS_NAME,
  'ps-3 pe-10 [&_option]:text-on-panel',
  'text-transparent focus:text-on-panel group-has-[option:checked:not([value=""])]/field:text-on-panel',
  '[&:disabled:not(:has(option:checked:not([value=""])))]:text-transparent',
].join(' ');

const LABEL_RAISED_CLASS_NAME = [
  'max-w-[calc(100%-3.25rem)]',
  'peer-focus:max-w-[calc((100%-3.25rem)/0.75)] peer-focus:translate-y-1.5 peer-focus:scale-75',
  'group-has-[option:checked:not([value=""])]/field:max-w-[calc((100%-3.25rem)/0.75)]',
  'group-has-[option:checked:not([value=""])]/field:translate-y-1.5 group-has-[option:checked:not([value=""])]/field:scale-75',
].join(' ');

const CHEVRON_CLASS_NAME = 'pointer-events-none absolute top-1/2 right-3 size-5 -translate-y-1/2 text-on-panel-muted';

export interface SelectFieldProps {
  children?: ReactNode;
  defaultValue?: string | undefined;
  error?: string | undefined;
  hint?: string | undefined;
  isOptional?: boolean | undefined;
  isReadOnly?: boolean | undefined;
  label: string;
  name: string;
  onBlur?: FocusEventHandler<HTMLSelectElement> | undefined;
  onChange?: ChangeEventHandler<HTMLSelectElement> | undefined;
  ref?: Ref<HTMLSelectElement> | undefined;
  value?: string | undefined;
}

export const SelectField = ({
  children,
  defaultValue,
  error,
  hint,
  isOptional = false,
  isReadOnly = false,
  label,
  name,
  onBlur,
  onChange,
  ref,
  value,
}: SelectFieldProps): ReactElement => {
  const controlId = useId();
  const messageId = `${controlId}-message`;
  const selectRef = useRef<HTMLSelectElement | null>(null);
  const lockedValueRef = useRef('');

  const isInvalid = error !== undefined;
  const isMessageShown = isInvalid || hint !== undefined;
  const borderClassName = getFieldBorderClassName({ isInvalid, isReadOnly });

  const setSelectRef = useCallback((element: HTMLSelectElement | null): void => {
    selectRef.current = element;

    if (typeof ref === 'function') {
      ref(element);

      return;
    }

    if (ref !== undefined && ref !== null) {
      ref.current = element;
    }
  }, [ref]);

  const handleChange = (event: ChangeEvent<HTMLSelectElement>): void => {
    console.log('> SelectField -> handleChange:', { isReadOnly, name });

    if (isReadOnly) {
      event.target.value = lockedValueRef.current;

      return;
    }

    onChange?.(event);
  };

  const handleMouseDown = (event: MouseEvent<HTMLSelectElement>): void => {
    if (isReadOnly) {
      console.log('> SelectField -> handleMouseDown:', { name });
      event.preventDefault();
    }
  };

  useEffect(() => {
    if (isReadOnly && selectRef.current !== null) {
      lockedValueRef.current = selectRef.current.value;
    }
  }, [isReadOnly]);

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
      <select
        aria-describedby={isMessageShown ? messageId : undefined}
        aria-invalid={isInvalid ? true : undefined}
        aria-readonly={isReadOnly ? true : undefined}
        className={cn('peer', CONTROL_CLASS_NAME, borderClassName)}
        defaultValue={value === undefined ? defaultValue : undefined}
        id={controlId}
        name={name}
        onBlur={onBlur}
        onChange={handleChange}
        onMouseDown={handleMouseDown}
        ref={setSelectRef}
        value={value}
      >
        {children}
      </select>
      <ChevronDown aria-hidden className={CHEVRON_CLASS_NAME} />
    </FieldFrame>
  );
};
