import type { ImportJob } from '@skladburg/contracts/import/v1/import';
import type { ReactElement } from 'react';

import { ErrorCode } from '@skladburg/contracts/common/v1/error';
import { ImportStatus } from '@skladburg/contracts/import/v1/import';
import {
  useId,
  useRef,
  useState,
} from 'react';

import { getFieldViolations } from '@/shared/api';
import { useI18n } from '@/shared/i18n';
import {
  AccessButton,
  ActionButton,
  Button,
  CommandErrorNotice,
} from '@/shared/ui';

import type { ImportTranslate } from '../../i18n/import/importSection';

import { readImportViolation } from '../../api/import/importFile';
import { useImportJobCommand } from '../../api/import/useImportJobCommand';
import { formatImportIssue } from './importPresentation';

interface ImportJobActionProps {
  isDisabled?: boolean | undefined;
  job: ImportJob;
  onSuccess: (job: ImportJob) => void;
  t: ImportTranslate;
  template: Parameters<typeof formatImportIssue>[2];
}

const handleConfirmationFocus = (button: HTMLButtonElement | null): void => {
  button?.focus();
};

export const ImportJobAction = ({ isDisabled, job, onSuccess, t, template }: ImportJobActionProps): ReactElement => {
  const { t: mainT } = useI18n();
  const { access, command, reload } = useImportJobCommand(job, onSuccess);
  const titleId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [isConfirming, setIsConfirming] = useState(false);

  const isCommit = job.status === ImportStatus.PREVIEW;
  const isConflicted = command.apiError?.code === ErrorCode.VERSION_CONFLICT;
  const isBlocked = command.apiError?.code === ErrorCode.IMPORT_ROLLBACK_BLOCKED;
  const isActionDisabled = isDisabled === true || isConflicted || isBlocked;
  const fieldErrors = command.apiError === undefined
    ? []
    : getFieldViolations(command.apiError).flatMap((violation) => {
        const location = readImportViolation(violation.fieldPath);
        return location === undefined ? [] : [{ ...location, columnNumber: 0, ruleId: violation.ruleId }];
      });

  const handleShowConfirmation = (): void => {
    setIsConfirming(true);
  };

  const handleCancel = (): void => {
    setIsConfirming(false);
    command.reset();
    triggerRef.current?.focus();
  };

  return (
    <div className="flex flex-col items-start gap-2">
      {isCommit
        ? (
            <ActionButton
              access={access}
              command={command}
              data-testid="catalog-import-commit"
              errorPlacement="external"
              isDisabled={isActionDisabled}
              variant="primary"
            >
              {t('catalogImport.commit')}
            </ActionButton>
          )
        : (
            <AccessButton
              access={access}
              aria-expanded={isConfirming}
              data-testid="catalog-import-rollback"
              isDisabled={isDisabled}
              onClick={handleShowConfirmation}
              ref={triggerRef}
              variant="secondary"
            >
              {t('catalogImport.rollback')}
            </AccessButton>
          )}
      {isConfirming && (
        <div aria-labelledby={titleId} className="flex flex-col gap-2 rounded-control border border-line p-3" role="group">
          <p className="font-semibold" id={titleId}>{t('catalogImport.confirm')}</p>
          <p>{t('catalogImport.confirmHint')}</p>
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={command.isPending}
              onClick={handleCancel}
              ref={handleConfirmationFocus}
              variant="secondary"
            >
              {t('catalogImport.cancel')}
            </Button>
            <ActionButton
              access={access}
              command={command}
              data-testid="catalog-import-confirm-rollback"
              errorPlacement="external"
              isDisabled={isActionDisabled}
              variant="primary"
            >
              {t('catalogImport.rollback')}
            </ActionButton>
          </div>
        </div>
      )}
      <CommandErrorNotice command={command} />
      {isConflicted && (
        <Button onClick={reload} variant="secondary">{t('catalogImport.refresh')}</Button>
      )}
      {fieldErrors.length > 0 && (
        <ul className="space-y-1 text-sm" role="alert">
          {fieldErrors.map((error, index) => (
            <li key={`${String(index)}:${error.fieldPath}`}>{formatImportIssue(t, mainT, template, error)}</li>
          ))}
        </ul>
      )}
    </div>
  );
};
