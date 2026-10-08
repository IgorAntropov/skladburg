import type {
  ButtonHTMLAttributes,
  MouseEvent,
  ReactElement,
  Ref,
} from 'react';

import { LoaderCircle } from 'lucide-react';

import { cn } from '@/shared/lib/cn';

import type {
  ButtonSizeValue,
  ButtonVariantValue,
} from './buttonTypes';

import { buttonClassName } from './buttonClassName';

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'type'> {
  pending?: boolean | undefined;
  pendingLabel?: string | undefined;
  ref?: Ref<HTMLButtonElement> | undefined;
  size?: ButtonSizeValue | undefined;
  type?: 'button' | 'submit' | undefined;
  variant?: ButtonVariantValue | undefined;
}

export const Button = ({
  children,
  className,
  onClick,
  pending = false,
  pendingLabel,
  size,
  type = 'button',
  variant,
  ...rest
}: ButtonProps): ReactElement => {
  const label = pending ? (pendingLabel ?? children) : children;

  const handleClick = (event: MouseEvent<HTMLButtonElement>): void => {
    console.log('> Button -> handleClick:', { pending, type });
    if (pending) {
      event.preventDefault();
      return;
    }
    onClick?.(event);
  };

  return (
    <button
      {...rest}
      aria-busy={pending ? true : undefined}
      aria-disabled={pending ? true : undefined}
      className={cn(buttonClassName({ size, variant }), className)}
      onClick={handleClick}
      type={type}
    >
      {pending && <LoaderCircle aria-hidden className="size-4 shrink-0 motion-safe:animate-spin" />}
      {label}
    </button>
  );
};
