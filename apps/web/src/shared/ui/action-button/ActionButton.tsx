import type {
  MouseEvent,
  ReactElement,
  ReactNode,
} from 'react';

import type {
  CommandAccessValue,
  CommandValue,
} from '@/shared/api';

import { useI18n } from '@/shared/i18n';

import type {
  ButtonSizeValue,
  ButtonVariantValue,
} from '../button/buttonTypes';
import type { TooltipProps } from '../tooltip/Tooltip';

import { AccessButton } from './AccessButton';
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

  const isPending = access.status === 'allowed' && command.isPending;
  const isRetryable = command.apiError?.isRetryable === true;
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
      <AccessButton
        access={access}
        className={className}
        data-testid={testId}
        onClick={handleClick}
        pending={isPending}
        pendingLabel={pendingLabel ?? t('action.pending')}
        size={size}
        tooltipSide={tooltipSide}
        type={type}
        variant={variant}
      >
        {label}
      </AccessButton>
      {isErrorBelow && <CommandErrorNotice command={command} />}
    </div>
  );
};
