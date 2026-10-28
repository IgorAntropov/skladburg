import type { LucideIcon } from 'lucide-react';
import type {
  ReactElement,
  ReactNode,
} from 'react';

import { cn } from '@/shared/lib/cn';

export type EmptyStateProps = EmptyStateIconProps | EmptyStateMediaProps;

interface EmptyStateBaseProps extends WithTestIdValue {
  action?: ReactNode | undefined;
  className?: string | undefined;
  hint?: string | undefined;
  text: string;
}

interface EmptyStateIconProps extends EmptyStateBaseProps {
  icon: LucideIcon;
  media?: undefined;
}

interface EmptyStateMediaProps extends EmptyStateBaseProps {
  icon?: undefined;
  media: ReactNode;
}

interface WithTestIdValue {
  'data-testid'?: string | undefined;
}

const ROOT_CLASS_NAME = 'flex flex-1 flex-col items-center justify-center gap-3 text-center';

const ICON_CLASS_NAME = 'flex size-10 shrink-0 items-center justify-center rounded-full bg-hover text-on-panel-muted';

const TEXT_BLOCK_CLASS_NAME = 'flex max-w-80 flex-col gap-1 @xl:max-w-none';

const TEXT_CLASS_NAME = 'text-base text-pretty text-on-panel-muted';

const HINT_CLASS_NAME = 'text-sm text-pretty text-on-panel-muted';

export const EmptyState = ({
  action,
  className,
  'data-testid': testId,
  hint,
  icon: Icon,
  media,
  text,
}: EmptyStateProps): ReactElement => {
  const isIconShown = Icon !== undefined;
  const isHintShown = hint !== undefined;

  return (
    <div className={cn(ROOT_CLASS_NAME, className)} data-testid={testId}>
      {isIconShown && (
        <span aria-hidden className={ICON_CLASS_NAME}>
          <Icon className="size-5" />
        </span>
      )}
      {media}
      <div className={TEXT_BLOCK_CLASS_NAME}>
        <p className={TEXT_CLASS_NAME}>{text}</p>
        {isHintShown && <p className={HINT_CLASS_NAME}>{hint}</p>}
      </div>
      {action}
    </div>
  );
};
