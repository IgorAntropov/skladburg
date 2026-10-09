import type {
  ChangeEvent,
  ReactElement,
} from 'react';

import { useId } from 'react';

import { cn } from '@/shared/lib/cn';

export interface SegmentedControlOptionValue<TValue extends string> {
  icon?: ReactElement | undefined;
  label: string;
  value: TValue;
}

export interface SegmentedControlProps<TValue extends string> {
  isLabelHidden?: boolean | undefined;
  label: string;
  onValueChange: (value: TValue) => void;
  options: readonly SegmentedControlOptionValue<TValue>[];
  value: TValue;
}

const FIELDSET_CLASS_NAME = 'm-0 inline-flex min-w-0 flex-col gap-1 border-0 p-0';

const LEGEND_CLASS_NAME = 'p-0 text-sm font-medium text-on-panel-muted';

const OPTIONS_CLASS_NAME = 'inline-flex gap-0.5 rounded-control bg-skeleton p-0.5 inset-ring inset-ring-line';

const OPTION_CLASS_NAME = [
  'relative inline-flex min-h-11 min-w-11 cursor-pointer touch-manipulation items-center justify-center gap-2',
  'rounded-md border border-transparent px-3 text-base font-medium text-on-panel select-none',
  'motion-safe:transition-[background-color,border-color,box-shadow]',
  'not-has-checked:hover:border-line-strong has-checked:border-indicator has-checked:bg-panel-solid has-checked:shadow-sm',
  'has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-focus',
].join(' ');

export const SegmentedControl = <TValue extends string>({
  isLabelHidden = false,
  label,
  onValueChange,
  options,
  value,
}: SegmentedControlProps<TValue>): ReactElement => {
  const name = useId();

  const handleOptionChange = (event: ChangeEvent<HTMLInputElement>): void => {
    const nextValue = event.currentTarget.value;
    const nextOption = options.find(option => option.value === nextValue);
    console.log('> SegmentedControl -> handleOptionChange:', { nextValue });
    if (nextOption === undefined) {
      return;
    }
    onValueChange(nextOption.value);
  };

  return (
    <fieldset className={FIELDSET_CLASS_NAME}>
      <legend className={cn(LEGEND_CLASS_NAME, isLabelHidden && 'sr-only')}>{label}</legend>
      <div className={OPTIONS_CLASS_NAME}>
        {options.map(option => (
          <label className={OPTION_CLASS_NAME} key={option.value}>
            <input
              checked={option.value === value}
              className="sr-only"
              name={name}
              onChange={handleOptionChange}
              type="radio"
              value={option.value}
            />
            {option.icon !== undefined && <span aria-hidden className="inline-flex shrink-0">{option.icon}</span>}
            <span data-segment-label>{option.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
};
