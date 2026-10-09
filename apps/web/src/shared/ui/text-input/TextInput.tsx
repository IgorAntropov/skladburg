import type {
  InputHTMLAttributes,
  ReactElement,
  Ref,
} from 'react';

import { cn } from '@/shared/lib/cn';

export interface TextInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  ref?: Ref<HTMLInputElement> | undefined;
  type?: 'search' | 'text' | undefined;
}

const TEXT_INPUT_CLASS_NAME = [
  'min-h-11 w-full min-w-0 appearance-none rounded-control border border-line-strong bg-panel-solid px-3 py-2 text-base text-on-panel',
  'placeholder:text-on-panel-muted hover:border-on-panel-muted',
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
  'disabled:border-line disabled:bg-skeleton disabled:text-on-panel-muted',
].join(' ');

export const TextInput = ({ className, type = 'text', ...rest }: TextInputProps): ReactElement => {
  return <input {...rest} className={cn(TEXT_INPUT_CLASS_NAME, className)} type={type} />;
};
