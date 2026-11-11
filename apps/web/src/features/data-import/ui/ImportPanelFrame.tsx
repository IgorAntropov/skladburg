import type {
  ReactElement,
  ReactNode,
} from 'react';

import { useId } from 'react';

import { Button } from '@/shared/ui';

import type { ImportTargetValue } from '../model/importTarget';

interface ImportPanelFrameProps {
  children: ReactNode;
  closeLabel: string;
  kind: ImportTargetValue['kind'];
  onClose: () => void;
  title: string;
}

const handleFocus = (button: HTMLButtonElement | null): void => {
  button?.focus();
};

export const ImportPanelFrame = ({
  children,
  closeLabel,
  kind,
  onClose,
  title,
}: ImportPanelFrameProps): ReactElement => {
  const titleId = useId();

  return (
    <section
      aria-labelledby={titleId}
      className="flex min-w-0 flex-col gap-3 text-on-panel"
      data-testid={`${kind}-import-panel`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold" id={titleId}>{title}</h2>
        <Button data-testid={`${kind}-import-close`} onClick={onClose} ref={handleFocus} variant="secondary">
          {closeLabel}
        </Button>
      </div>
      {children}
    </section>
  );
};
