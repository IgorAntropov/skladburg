import type {
  ChangeEventHandler,
  FocusEventHandler,
  MouseEvent,
  ReactElement,
  Ref,
} from 'react';

import { useId } from 'react';

import { cn } from '@/shared/lib/cn';

import type { WithTestIdValue } from '../test-id/testIdTypes';

import { FieldMessage } from './FieldMessage';

const TRACK_CLASS_NAME = [
  'relative h-6 w-10 shrink-0 rounded-full border border-line-strong bg-hover',
  'peer-checked:border-indicator peer-checked:bg-indicator',
  'motion-safe:transition-colors motion-safe:duration-(--duration-fast) motion-safe:ease-out',
].join(' ');

const THUMB_CLASS_NAME = [
  'absolute top-[3px] left-[3px] size-4 rounded-full bg-on-panel-muted',
  'group-has-checked/switch:translate-x-4 group-has-checked/switch:bg-panel-solid',
  'motion-safe:transition-[translate,background-color] motion-safe:duration-(--duration-fast) motion-safe:ease-out',
].join(' ');

const ROW_CLASS_NAME = [
  'group/switch flex min-h-14 w-full items-center justify-between gap-3 rounded-control border px-3 py-2 text-left',
  'has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-focus',
].join(' ');

const ROW_ENABLED_CLASS_NAME = 'cursor-pointer touch-manipulation text-on-panel hover:bg-hover active:bg-line';

const ROW_READ_ONLY_CLASS_NAME = 'cursor-default text-on-panel';

const ROW_DISABLED_CLASS_NAME = 'cursor-not-allowed border-line bg-skeleton text-on-panel-muted';

const ROW_BORDER_CLASS_NAME = 'border-line';

const ROW_INVALID_CLASS_NAME = 'border-status-alarm';

const LABEL_CLASS_NAME = 'text-base font-medium';

const HINT_CLASS_NAME = 'text-sm leading-5 font-normal text-on-panel-muted';

export interface SwitchFieldProps extends WithTestIdValue {
  'aria-controls'?: string | undefined;
  'error'?: string | undefined;
  'hint'?: string | undefined;
  'isDisabled'?: boolean | undefined;
  'isReadOnly'?: boolean | undefined;
  'label': string;
  'name': string;
  'onBlur'?: FocusEventHandler<HTMLInputElement> | undefined;
  'onChange'?: ChangeEventHandler<HTMLInputElement> | undefined;
  'ref'?: Ref<HTMLInputElement> | undefined;
}

const getRowStateClassName = (isDisabled: boolean, isReadOnly: boolean): string => {
  if (isDisabled) {
    return ROW_DISABLED_CLASS_NAME;
  }

  return isReadOnly ? ROW_READ_ONLY_CLASS_NAME : ROW_ENABLED_CLASS_NAME;
};

interface DescribedByValue {
  hintId: string;
  isHintShown: boolean;
  isInvalid: boolean;
  messageId: string;
}

const getDescribedBy = ({ hintId, isHintShown, isInvalid, messageId }: DescribedByValue): string | undefined => {
  if (isInvalid) {
    return messageId;
  }

  return isHintShown ? hintId : undefined;
};

export const SwitchField = ({
  'aria-controls': ariaControls,
  'data-testid': testId,
  error,
  hint,
  isDisabled = false,
  isReadOnly = false,
  label,
  name,
  onBlur,
  onChange,
  ref,
}: SwitchFieldProps): ReactElement => {
  const controlId = useId();
  const hintId = `${controlId}-hint`;
  const labelId = `${controlId}-label`;
  const messageId = `${controlId}-message`;

  const isInvalid = error !== undefined;
  const isHintShown = hint !== undefined && !isInvalid;
  const describedBy = getDescribedBy({ hintId, isHintShown, isInvalid, messageId });
  const borderClassName = isInvalid && !isDisabled ? ROW_INVALID_CLASS_NAME : ROW_BORDER_CLASS_NAME;

  const handleInputChange: ChangeEventHandler<HTMLInputElement> = (event) => {
    if (!isReadOnly) {
      onChange?.(event);
    }
  };

  const handleInputClick = (event: MouseEvent<HTMLInputElement>): void => {
    if (isReadOnly) {
      event.preventDefault();
    }
  };

  return (
    <div className="flex flex-col gap-1">
      <label className={cn(ROW_CLASS_NAME, borderClassName, getRowStateClassName(isDisabled, isReadOnly))} data-testid={testId}>
        <input
          aria-controls={ariaControls}
          aria-describedby={describedBy}
          aria-invalid={isInvalid ? true : undefined}
          aria-labelledby={labelId}
          aria-readonly={isReadOnly ? true : undefined}
          className="peer sr-only"
          disabled={isDisabled}
          name={name}
          onBlur={onBlur}
          onChange={handleInputChange}
          onClick={handleInputClick}
          ref={ref}
          role="switch"
          type="checkbox"
        />
        <span className="flex min-w-0 flex-col">
          <span className={LABEL_CLASS_NAME} id={labelId}>{label}</span>
          {isHintShown && <span className={HINT_CLASS_NAME} id={hintId}>{hint}</span>}
        </span>
        <span aria-hidden className={TRACK_CLASS_NAME}>
          <span className={THUMB_CLASS_NAME} />
        </span>
      </label>
      <FieldMessage error={error} id={messageId} />
    </div>
  );
};
