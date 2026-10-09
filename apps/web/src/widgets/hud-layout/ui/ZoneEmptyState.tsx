import type { LucideIcon } from 'lucide-react';
import type { ReactElement } from 'react';

interface ZoneEmptyStateProps {
  icon: LucideIcon;
  text: string;
}

const ROOT_CLASS_NAME = 'flex flex-1 flex-col items-center justify-center gap-3 text-center';

const ICON_CLASS_NAME = 'flex size-10 shrink-0 items-center justify-center rounded-full bg-hover text-on-panel-muted';

const TEXT_CLASS_NAME = 'max-w-80 text-base text-pretty text-on-panel-muted @xl:max-w-none';

export const ZoneEmptyState = ({ icon: Icon, text }: ZoneEmptyStateProps): ReactElement => {
  return (
    <div className={ROOT_CLASS_NAME}>
      <span aria-hidden className={ICON_CLASS_NAME}>
        <Icon className="size-5" />
      </span>
      <p className={TEXT_CLASS_NAME}>{text}</p>
    </div>
  );
};
