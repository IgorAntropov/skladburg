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

const LABEL_CELL_CLASS_NAME = 'col-start-1 row-start-1 inline-flex items-center justify-center gap-2';

const SPINNER_CLASS_NAME = 'size-4 shrink-0';

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
  const isLabelPairShown = pendingLabel !== undefined;

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
      {isLabelPairShown
        ? (
            <span className="inline-grid">
              <span aria-hidden={pending ? true : undefined} className={cn(LABEL_CELL_CLASS_NAME, pending && 'invisible')}>
                {children}
              </span>
              <span aria-hidden={pending ? undefined : true} className={cn(LABEL_CELL_CLASS_NAME, !pending && 'invisible')}>
                <LoaderCircle aria-hidden className={cn(SPINNER_CLASS_NAME, pending && 'motion-safe:animate-spin')} />
                {pendingLabel}
              </span>
            </span>
          )
        : (
            <>
              {pending && <LoaderCircle aria-hidden className={cn(SPINNER_CLASS_NAME, 'motion-safe:animate-spin')} />}
              {children}
            </>
          )}
    </button>
  );
};
