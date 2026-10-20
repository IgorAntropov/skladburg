import type {
  InputHTMLAttributes,
  ReactElement,
  Ref,
} from 'react';

import { cn } from '@/shared/lib/cn';

import {
  FIELD_BORDER_CLASS_NAME,
  FIELD_SURFACE_CLASS_NAME,
  FIELD_TEXT_CLASS_NAME,
  TEXT_INPUT_SIZE_CLASS_NAME,
} from '../form-field/fieldSurfaceStyles';

export interface TextInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  ref?: Ref<HTMLInputElement> | undefined;
  type?: 'search' | 'text' | undefined;
}

const TEXT_INPUT_CLASS_NAME = [
  FIELD_SURFACE_CLASS_NAME,
  FIELD_TEXT_CLASS_NAME,
  FIELD_BORDER_CLASS_NAME,
  TEXT_INPUT_SIZE_CLASS_NAME,
  'placeholder:text-on-panel-muted',
].join(' ');

export const TextInput = ({ className, type = 'text', ...rest }: TextInputProps): ReactElement => {
  return <input {...rest} className={cn(TEXT_INPUT_CLASS_NAME, className)} type={type} />;
};
