import type {
  ReactElement,
  ReactNode,
} from 'react';

import { TriangleAlert } from 'lucide-react';

export interface StatusScreenProps {
  action?: ReactNode | undefined;
  announceKey?: number | string | undefined;
  description?: string | undefined;
  layout: 'app' | 'section';
  title: string;
  tone: 'error' | 'neutral';
}

const APP_LAYOUT_CLASS_NAME = 'flex min-h-dvh flex-col items-center justify-center gap-4 bg-canvas px-4 text-center text-on-canvas';

const SECTION_LAYOUT_CLASS_NAME = 'mx-auto flex w-full max-w-2xl flex-col items-start gap-4 px-4 py-12';

const TITLE_CLASS_NAME = 'text-balance text-2xl font-semibold tracking-tight';

const DESCRIPTION_CLASS_NAME = 'max-w-prose text-balance text-lg text-on-canvas-muted';

const ERROR_BADGE_CLASS_NAME = 'flex size-12 shrink-0 items-center justify-center rounded-full bg-status-alarm text-on-status-alarm';

export const StatusScreen = ({ action, announceKey, description, layout, title, tone }: StatusScreenProps): ReactElement => {
  const isErrorTone = tone === 'error';

  const content = (
    <>
      {isErrorTone && (
        <span aria-hidden className={ERROR_BADGE_CLASS_NAME}>
          <TriangleAlert className="size-6" />
        </span>
      )}
      {isErrorTone
        ? <div key={announceKey} role="alert"><h1 className={TITLE_CLASS_NAME}>{title}</h1></div>
        : <h1 className={TITLE_CLASS_NAME}>{title}</h1>}
      {description !== undefined && <p className={DESCRIPTION_CLASS_NAME}>{description}</p>}
      {action}
    </>
  );

  if (layout === 'app') {
    return <main className={APP_LAYOUT_CLASS_NAME}>{content}</main>;
  }

  return <div className={SECTION_LAYOUT_CLASS_NAME}>{content}</div>;
};
