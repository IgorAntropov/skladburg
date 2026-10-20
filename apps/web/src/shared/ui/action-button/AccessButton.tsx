import type { ReactElement } from 'react';

import { useId } from 'react';

import type { CommandAccessValue } from '@/shared/api';

import { translatePermissionDenial } from '@/shared/api';
import { useI18n } from '@/shared/i18n';

import type { ButtonProps } from '../button/Button';
import type { TooltipProps } from '../tooltip/Tooltip';

import { Button } from '../button/Button';
import { Tooltip } from '../tooltip/Tooltip';

const ACCESS_REASON_CLASS_NAME = 'sr-only pointer-coarse:not-sr-only max-w-prose text-sm text-pretty wrap-break-word text-on-panel-muted';

export interface AccessButtonProps extends Omit<ButtonProps, 'aria-describedby' | 'aria-disabled'> {
  access: CommandAccessValue;
  tooltipSide?: TooltipProps['side'] | undefined;
}

export const AccessButton = ({
  access,
  children,
  tooltipSide,
  ...buttonProps
}: AccessButtonProps): ReactElement => {
  const { t } = useI18n();
  const reasonId = useId();

  const denialReason = access.status === 'denied' ? translatePermissionDenial(t, access.permission) : undefined;
  const isDenied = denialReason !== undefined;
  const describedById = isDenied ? reasonId : undefined;
  const isBlocked = access.status !== 'allowed';

  return (
    <div className="flex max-w-full flex-col items-start gap-2">
      <Tooltip canOpen={isDenied} content={denialReason ?? ''} side={tooltipSide}>
        <Button {...buttonProps} aria-describedby={describedById} aria-disabled={isBlocked}>
          {children}
        </Button>
      </Tooltip>
      {isDenied && <span className={ACCESS_REASON_CLASS_NAME} id={reasonId}>{denialReason}</span>}
    </div>
  );
};
