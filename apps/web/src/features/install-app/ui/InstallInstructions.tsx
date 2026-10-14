import type { LucideIcon } from 'lucide-react';
import type {
  KeyboardEvent,
  ReactElement,
} from 'react';

import {
  Check,
  Share,
  SquarePlus,
} from 'lucide-react';
import {
  useEffect,
  useId,
  useRef,
} from 'react';

import { useI18n } from '@/shared/i18n';
import { Button } from '@/shared/ui';

const STEP_ICON_CLASS_NAME = 'flex size-9 shrink-0 items-center justify-center rounded-control border border-line bg-hover text-on-panel';

interface InstallStepProps {
  hint?: string | undefined;
  icon: LucideIcon;
  label: string;
  number: number;
}

const InstallStep = ({
  hint,
  icon: Icon,
  label,
  number,
}: InstallStepProps): ReactElement => {
  return (
    <li className="flex items-center gap-2">
      <span aria-hidden className="w-3 shrink-0 text-center text-sm font-medium text-on-panel-muted tabular-nums">{number}</span>
      <span aria-hidden className={STEP_ICON_CLASS_NAME}><Icon className="size-5" /></span>
      <span className="flex min-w-0 flex-col">
        <span className="text-base">{label}</span>
        {hint !== undefined && <span className="text-sm text-on-panel-muted">{hint}</span>}
      </span>
    </li>
  );
};

interface InstallInstructionsProps {
  onClose: () => void;
}

export const InstallInstructions = ({ onClose }: InstallInstructionsProps): ReactElement => {
  const { t } = useI18n();
  const titleId = useId();
  const whyId = useId();
  const stepsId = useId();
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  const descriptionIds = `${whyId} ${stepsId}`;

  const handleCloseClick = (): void => {
    console.log('> InstallInstructions -> handleCloseClick:', {});
    onClose();
  };

  const handleGroupKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key !== 'Escape') {
      return;
    }
    console.log('> InstallInstructions -> handleGroupKeyDown:', {});
    event.stopPropagation();
    onClose();
  };

  useEffect(() => {
    closeButtonRef.current?.focus();
  }, []);

  return (
    <div
      aria-describedby={descriptionIds}
      aria-labelledby={titleId}
      className="flex max-w-76 flex-col items-start gap-4"
      onKeyDown={handleGroupKeyDown}
      role="group"
    >
      <div className="flex flex-col">
        <p className="text-base font-medium" id={titleId}>{t('install.instructions.title')}</p>
        <p className="text-sm text-on-panel-muted" id={whyId}>{t('install.instructions.why')}</p>
      </div>
      <ol className="flex flex-col gap-3" id={stepsId} role="list">
        <InstallStep
          hint={t('install.instructions.shareHint')}
          icon={Share}
          label={t('install.instructions.share')}
          number={1}
        />
        <InstallStep
          hint={t('install.instructions.addToHomeHint')}
          icon={SquarePlus}
          label={t('install.instructions.addToHome')}
          number={2}
        />
        <InstallStep
          icon={Check}
          label={t('install.instructions.confirm')}
          number={3}
        />
      </ol>
      <Button className="min-w-28" onClick={handleCloseClick} ref={closeButtonRef} variant="secondary">
        {t('install.instructions.close')}
      </Button>
    </div>
  );
};
