import type {
  ChangeEvent,
  MouseEvent,
  ReactElement,
  ReactNode,
  Ref,
} from 'react';

import { TriangleAlert } from 'lucide-react';
import { useRef } from 'react';

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

import { AccessButton } from '../action-button/AccessButton';
import { CommandErrorNotice } from '../action-button/CommandErrorNotice';

const ERROR_BADGE_CLASS_NAME = 'flex size-6 shrink-0 items-center justify-center rounded-full bg-status-alarm text-on-status-alarm';

export interface FileButtonProps extends WithTestIdValue {
  accept: string;
  access: CommandAccessValue;
  buttonRef?: Ref<HTMLButtonElement> | undefined;
  children: ReactNode;
  className?: string | undefined;
  command: CommandValue;
  errorMessage?: string | undefined;
  errorPlacement?: 'below' | 'external' | undefined;
  onFileSelect: (file: File) => void;
  pendingLabel?: string | undefined;
  size?: ButtonSizeValue | undefined;
  tooltipSide?: TooltipProps['side'] | undefined;
  variant?: ButtonVariantValue | undefined;
}

interface WithTestIdValue {
  'data-testid'?: string | undefined;
}

export const FileButton = ({
  accept,
  access,
  buttonRef,
  children,
  className,
  command,
  'data-testid': testId,
  errorMessage,
  errorPlacement = 'below',
  onFileSelect,
  pendingLabel,
  size,
  tooltipSide,
  variant,
}: FileButtonProps): ReactElement => {
  const { t } = useI18n();
  const inputRef = useRef<HTMLInputElement>(null);

  const isSelectionAllowed = access.status === 'allowed' && !command.isPending;
  const isErrorBelow = errorPlacement === 'below';
  const hasErrorMessage = errorMessage !== undefined;
  const isClientErrorShown = isErrorBelow && hasErrorMessage;
  const isCommandErrorShown = isErrorBelow && !hasErrorMessage;
  const inputTestId = testId === undefined ? undefined : `${testId}-input`;

  const handleButtonClick = (event: MouseEvent<HTMLButtonElement>): void => {
    console.log('> FileButton -> handleButtonClick:', { method: command.method?.name });
    event.currentTarget.focus();
    inputRef.current?.click();
  };

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>): void => {
    const input = event.currentTarget;
    const file = input.files?.[0];

    input.value = '';
    console.log('> FileButton -> handleInputChange:', { hasFile: file !== undefined, isSelectionAllowed });
    if (file === undefined || !isSelectionAllowed) {
      return;
    }
    onFileSelect(file);
  };

  return (
    <div className="flex max-w-full flex-col items-start gap-2">
      <AccessButton
        access={access}
        className={className}
        data-testid={testId}
        onClick={handleButtonClick}
        pending={command.isPending}
        pendingLabel={pendingLabel ?? t('action.pending')}
        ref={buttonRef}
        size={size}
        tooltipSide={tooltipSide}
        variant={variant}
      >
        {children}
      </AccessButton>
      <input
        accept={accept}
        data-testid={inputTestId}
        hidden
        onChange={handleInputChange}
        ref={inputRef}
        type="file"
      />
      {isClientErrorShown && (
        <div className="flex items-start gap-2">
          <span aria-hidden className={ERROR_BADGE_CLASS_NAME}>
            <TriangleAlert className="size-4" />
          </span>
          <p className="text-base leading-6" role="alert">{errorMessage}</p>
        </div>
      )}
      {isCommandErrorShown && <CommandErrorNotice command={command} />}
    </div>
  );
};
