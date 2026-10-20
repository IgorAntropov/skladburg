import type {
  MouseEvent,
  ReactElement,
  ReactNode,
} from 'react';

import { useId } from 'react';

import type {
  CommandAccessValue,
  CommandValue,
} from '@/shared/api';

import { translatePermissionDenial } from '@/shared/api';
import { useI18n } from '@/shared/i18n';

import type {
  ButtonSizeValue,
  ButtonVariantValue,
} from '../button/buttonTypes';
import type { TooltipProps } from '../tooltip/Tooltip';

import { Button } from '../button/Button';
import { Tooltip } from '../tooltip/Tooltip';
import { CommandErrorNotice } from './CommandErrorNotice';

export interface ActionButtonProps extends WithTestIdValue {
  access: CommandAccessValue;
  children: ReactNode;
  className?: string | undefined;
  command: CommandValue;
  errorPlacement?: 'below' | 'external' | undefined;
  pendingLabel?: string | undefined;
  size?: ButtonSizeValue | undefined;
  tooltipSide?: TooltipProps['side'] | undefined;
  type?: 'button' | 'submit' | undefined;
  variant?: ButtonVariantValue | undefined;
}

interface WithTestIdValue {
  'data-testid'?: string | undefined;
}

export const ActionButton = ({
  access,
  children,
  className,
  command,
  'data-testid': testId,
  errorPlacement = 'below',
  pendingLabel,
  size,
  tooltipSide,
  type = 'button',
  variant,
}: ActionButtonProps): ReactElement => {
  const { t } = useI18n();
  const reasonId = useId();

  const isAllowed = access.status === 'allowed';
  const isPending = isAllowed && command.isPending;
  const isRetryable = command.apiError?.isRetryable === true;
  const denialReason = access.status === 'denied' ? translatePermissionDenial(t, access.permission) : undefined;
  const isDenied = denialReason !== undefined;
  const describedById = isDenied ? reasonId : undefined;
  const isBlocked = !isAllowed;
  const isErrorBelow = errorPlacement === 'below';
  const isSubmit = type === 'submit';
  const label = isRetryable ? t('common.retry') : children;

  const handleClick = (event: MouseEvent<HTMLButtonElement>): void => {
    console.log('> ActionButton -> handleClick:', { isRetryable, method: command.method?.name });
    event.currentTarget.focus();
    if (isSubmit) {
      return;
    }
    command.run();
  };

  return (
    <div className="flex max-w-full flex-col items-start gap-2">
      <Tooltip canOpen={isDenied} content={denialReason ?? ''} side={tooltipSide}>
        <Button
          aria-describedby={describedById}
          aria-disabled={isBlocked}
          className={className}
          data-testid={testId}
          onClick={handleClick}
          pending={isPending}
          pendingLabel={pendingLabel ?? t('action.pending')}
          size={size}
          type={type}
          variant={variant}
        >
          {label}
        </Button>
      </Tooltip>
      {isDenied && <span className="sr-only" id={reasonId}>{denialReason}</span>}
      {isErrorBelow && <CommandErrorNotice command={command} />}
    </div>
  );
};
