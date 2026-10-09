import type { ReactElement } from 'react';

import { cn } from '@/shared/lib/cn';

import type { ButtonProps } from '../button/Button';

import { Button } from '../button/Button';

export interface IconButtonProps extends Omit<ButtonProps, 'children' | 'pendingLabel'> {
  icon: ReactElement;
  label: string;
}

const ICON_BUTTON_CLASS_NAME = 'shrink-0 px-0!';

const ICON_BUTTON_SIZE_CLASS_NAMES = {
  lg: 'size-12',
  md: 'size-11',
} as const;

export const IconButton = ({
  className,
  icon,
  label,
  pending = false,
  size = 'md',
  ...rest
}: IconButtonProps): ReactElement => {
  return (
    <Button
      {...rest}
      aria-label={label}
      className={cn(ICON_BUTTON_CLASS_NAME, ICON_BUTTON_SIZE_CLASS_NAMES[size], className)}
      pending={pending}
      size={size}
    >
      {pending ? null : <span aria-hidden className="inline-flex">{icon}</span>}
    </Button>
  );
};
