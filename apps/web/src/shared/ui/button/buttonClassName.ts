import { cn } from '@/shared/lib/cn';

import type {
  ButtonSizeValue,
  ButtonVariantValue,
} from './buttonTypes';

const BUTTON_BASE_CLASS_NAME = [
  'inline-flex touch-manipulation items-center justify-center gap-2 rounded-control border py-2 font-medium select-none',
  'motion-safe:transition-[background-color,border-color,color,filter]',
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
  'aria-busy:cursor-progress disabled:cursor-not-allowed',
].join(' ');

const BUTTON_SIZE_CLASS_NAMES: Readonly<Record<ButtonSizeValue, string>> = {
  lg: 'min-h-12 px-6 text-base',
  md: 'min-h-11 px-4 text-base',
};

const BUTTON_VARIANT_CLASS_NAMES: Readonly<Record<ButtonVariantValue, string>> = {
  ghost: [
    'border-transparent bg-transparent text-link',
    'enabled:not-aria-busy:hover:bg-skeleton enabled:not-aria-busy:hover:text-on-panel',
    'enabled:not-aria-busy:active:bg-line enabled:not-aria-busy:active:text-on-panel',
    'aria-expanded:bg-line aria-expanded:text-on-panel',
    'disabled:text-on-panel-muted',
  ].join(' '),
  primary: [
    'border-transparent bg-primary text-on-primary',
    'enabled:not-aria-busy:hover:brightness-90 enabled:not-aria-busy:active:brightness-75',
    'disabled:border-line disabled:bg-skeleton disabled:text-on-panel-muted',
  ].join(' '),
  secondary: [
    'border-line-strong bg-transparent text-link',
    'enabled:not-aria-busy:hover:border-on-panel-muted enabled:not-aria-busy:hover:bg-skeleton enabled:not-aria-busy:hover:text-on-panel',
    'enabled:not-aria-busy:active:bg-line enabled:not-aria-busy:active:text-on-panel',
    'aria-expanded:bg-line aria-expanded:text-on-panel',
    'disabled:border-line disabled:text-on-panel-muted',
  ].join(' '),
};

interface ButtonClassNameOptionsValue {
  size?: ButtonSizeValue | undefined;
  variant?: ButtonVariantValue | undefined;
}

export const buttonClassName = ({ size = 'md', variant = 'primary' }: ButtonClassNameOptionsValue): string => {
  return cn(BUTTON_BASE_CLASS_NAME, BUTTON_SIZE_CLASS_NAMES[size], BUTTON_VARIANT_CLASS_NAMES[variant]);
};
