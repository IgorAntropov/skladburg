import type { ReactElement } from 'react';

interface PanelPlaceholderProps {
  description: string;
  title: string;
}

const ROOT_CLASS_NAME = 'flex flex-col gap-2';

const TITLE_CLASS_NAME = 'text-2xl font-semibold tracking-tight text-balance';

const DESCRIPTION_CLASS_NAME = 'max-w-prose text-base text-pretty text-on-panel-muted';

export const PanelPlaceholder = ({ description, title }: PanelPlaceholderProps): ReactElement => {
  return (
    <div className={ROOT_CLASS_NAME}>
      <h1 className={TITLE_CLASS_NAME}>{title}</h1>
      <p className={DESCRIPTION_CLASS_NAME}>{description}</p>
    </div>
  );
};
