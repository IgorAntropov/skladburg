import type { ReactElement } from 'react';

import { TriangleAlert } from 'lucide-react';

const MESSAGE_CLASS_NAME = 'text-sm leading-5';
const HINT_CLASS_NAME = `${MESSAGE_CLASS_NAME} text-on-panel-muted`;
const ERROR_CLASS_NAME = `${MESSAGE_CLASS_NAME} flex items-start gap-2 text-on-panel`;
const ERROR_BADGE_CLASS_NAME = 'flex size-5 shrink-0 items-center justify-center rounded-full bg-status-alarm text-on-status-alarm';

export interface FieldMessageProps {
  error?: string | undefined;
  hint?: string | undefined;
  id: string;
}

export const FieldMessage = ({ error, hint, id }: FieldMessageProps): null | ReactElement => {
  if (error !== undefined) {
    return (
      <p className={ERROR_CLASS_NAME} id={id}>
        <span aria-hidden className={ERROR_BADGE_CLASS_NAME}>
          <TriangleAlert className="size-3" />
        </span>
        <span>{error}</span>
      </p>
    );
  }

  return hint === undefined ? null : <p className={HINT_CLASS_NAME} id={id}>{hint}</p>;
};
