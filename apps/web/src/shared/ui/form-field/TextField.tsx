import type {
  ChangeEventHandler,
  FocusEventHandler,
  InputEventHandler,
  InputHTMLAttributes,
  ReactElement,
  Ref,
} from 'react';

import {
  useEffect,
  useId,
  useRef,
} from 'react';

import type { InputMaskValue } from '@/shared/lib/mask';

import { cn } from '@/shared/lib/cn';

import { FieldFrame } from './FieldFrame';
import {
  FIELD_AUTOFILL_CLASS_NAME,
  FIELD_CONTROL_SIZE_CLASS_NAME,
  getFieldBorderClassName,
} from './fieldStyles';
import {
  FIELD_SURFACE_CLASS_NAME,
  FIELD_TEXT_CLASS_NAME,
} from './fieldSurfaceStyles';

const EMPTY_PLACEHOLDER = ' ';

const CONTROL_CLASS_NAME = [
  FIELD_SURFACE_CLASS_NAME,
  FIELD_TEXT_CLASS_NAME,
  FIELD_CONTROL_SIZE_CLASS_NAME,
  FIELD_AUTOFILL_CLASS_NAME,
  'peer px-3',
  'placeholder:text-transparent focus:placeholder:text-on-panel-muted',
].join(' ');

const LABEL_RAISED_CLASS_NAME = [
  'max-w-[calc(100%-1.5rem)]',
  'peer-focus:max-w-[calc((100%-1.5rem)/0.75)] peer-focus:translate-y-1.5 peer-focus:scale-75',
  'peer-not-placeholder-shown:max-w-[calc((100%-1.5rem)/0.75)]',
  'peer-not-placeholder-shown:translate-y-1.5 peer-not-placeholder-shown:scale-75',
  'peer-autofill:max-w-[calc((100%-1.5rem)/0.75)] peer-autofill:translate-y-1.5 peer-autofill:scale-75',
].join(' ');

export interface TextFieldProps {
  autoComplete?: string | undefined;
  defaultValue?: string | undefined;
  enterKeyHint?: InputHTMLAttributes<HTMLInputElement>['enterKeyHint'];
  error?: string | undefined;
  hint?: string | undefined;
  inputMode?: InputHTMLAttributes<HTMLInputElement>['inputMode'];
  isOptional?: boolean | undefined;
  isReadOnly?: boolean | undefined;
  label: string;
  mask?: InputMaskValue | undefined;
  name: string;
  onBlur?: FocusEventHandler<HTMLInputElement> | undefined;
  onChange?: ChangeEventHandler<HTMLInputElement> | undefined;
  onInput?: InputEventHandler<HTMLInputElement> | undefined;
  placeholder?: string | undefined;
  ref?: Ref<HTMLInputElement> | undefined;
  spellCheck?: boolean | undefined;
  type?: 'email' | 'tel' | 'text' | 'url' | undefined;
}

export const TextField = ({
  autoComplete,
  defaultValue,
  enterKeyHint,
  error,
  hint,
  inputMode,
  isOptional = false,
  isReadOnly = false,
  label,
  mask,
  name,
  onBlur,
  onChange,
  onInput,
  placeholder,
  ref,
  spellCheck,
  type = 'text',
}: TextFieldProps): ReactElement => {
  const controlId = useId();
  const messageId = `${controlId}-message`;
  const inputRef = useRef<HTMLInputElement | null>(null);

  const isInvalid = error !== undefined;
  const isMessageShown = isInvalid || hint !== undefined;
  const borderClassName = getFieldBorderClassName({ isInvalid, isReadOnly });

  const handleRef = (instance: HTMLInputElement | null): void => {
    inputRef.current = instance;

    if (typeof ref === 'function') {
      ref(instance);
    }
    else if (ref !== undefined && ref !== null) {
      ref.current = instance;
    }
  };

  useEffect(() => {
    const input = inputRef.current;

    if (mask === undefined || input === null) {
      return undefined;
    }

    return mask.attach(input);
  }, [mask]);

  useEffect(() => {
    const input = inputRef.current;

    if (mask !== undefined && input !== null) {
      mask.refresh(input);
    }
  });

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
        autoComplete={autoComplete}
        className={cn(CONTROL_CLASS_NAME, borderClassName)}
        defaultValue={defaultValue}
        enterKeyHint={enterKeyHint}
        id={controlId}
        inputMode={inputMode ?? mask?.inputMode}
        name={name}
        onBlur={onBlur}
        onChange={onChange}
        onInput={onInput}
        placeholder={placeholder ?? mask?.template ?? EMPTY_PLACEHOLDER}
        readOnly={isReadOnly}
        ref={mask === undefined ? ref : handleRef}
        spellCheck={spellCheck ?? (mask === undefined ? undefined : false)}
        type={type}
      />
    </FieldFrame>
  );
};
