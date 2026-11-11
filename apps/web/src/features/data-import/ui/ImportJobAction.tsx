import type { ImportJob } from '@skladburg/contracts/import/v1/import';
import type { ReactElement } from 'react';

import { EntityKindSchema } from '@skladburg/contracts/common/v1/entity';
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

import type { ImportOptionsValue } from '../model/importOptions';

import { readImportViolation } from '../api/importFile';
import { useImportJobCommand } from '../api/useImportJobCommand';
import { formatImportIssue } from './importPresentation';

interface ImportJobActionProps {
  isDisabled?: boolean | undefined;
  job: ImportJob;
  onChooseFile?: (() => void) | undefined;
  onSuccess: (job: ImportJob) => void;
  options: ImportOptionsValue;
  template: Parameters<typeof formatImportIssue>[2];
}

const warehouseEntity = EntityKindSchema.values.find(kind => kind.localName === 'WAREHOUSE')?.number;

const handleConfirmationFocus = (button: HTMLButtonElement | null): void => {
  button?.focus();
};

export const ImportJobAction = ({ isDisabled, job, onChooseFile, onSuccess, options, template }: ImportJobActionProps): ReactElement => {
  const { t: mainT } = useI18n();
  const { access, command, reload } = useImportJobCommand(options, job, onSuccess);
  const titleId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [isConfirming, setIsConfirming] = useState(false);

  const { apiError } = command;
  const { t, target } = options;
  const isCommit = job.status === ImportStatus.PREVIEW;
  const isConflicted = apiError?.code === ErrorCode.VERSION_CONFLICT;
  const hasStaleTopology = isCommit && target.kind === 'warehouse' && isConflicted
    && apiError.params.case === 'versionConflict' && apiError.params.value.entity === warehouseEntity;
  const isBlocked = apiError?.code === ErrorCode.IMPORT_ROLLBACK_BLOCKED;
  const isActionDisabled = isDisabled === true || isConflicted || isBlocked;
  const fieldErrors = apiError === undefined
    ? []
    : getFieldViolations(apiError).flatMap((violation) => {
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
              data-testid={`${target.kind}-import-commit`}
              errorPlacement="external"
              isDisabled={isActionDisabled}
              variant="primary"
            >
              {t('dataImport.commit')}
            </ActionButton>
          )
        : (
            <AccessButton
              access={access}
              aria-expanded={isConfirming}
              data-testid={`${target.kind}-import-rollback`}
              isDisabled={isDisabled}
              onClick={handleShowConfirmation}
              ref={triggerRef}
              variant="secondary"
            >
              {t('dataImport.rollback')}
            </AccessButton>
          )}
      {isConfirming && (
        <div aria-labelledby={titleId} className="flex flex-col gap-2 rounded-control border border-line p-3" role="group">
          <p className="font-semibold" id={titleId}>{t('dataImport.confirm')}</p>
          <p>{t('dataImport.confirmHint')}</p>
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={command.isPending}
              onClick={handleCancel}
              ref={handleConfirmationFocus}
              variant="secondary"
            >
              {t('dataImport.cancel')}
            </Button>
            <ActionButton
              access={access}
              command={command}
              data-testid={`${target.kind}-import-confirm-rollback`}
              errorPlacement="external"
              isDisabled={isActionDisabled}
              variant="primary"
            >
              {t('dataImport.rollback')}
            </ActionButton>
          </div>
        </div>
      )}
      {hasStaleTopology
        ? <p className="text-base leading-6" role="alert">{t('dataImport.topologyChanged')}</p>
        : <CommandErrorNotice command={command} />}
      {hasStaleTopology && onChooseFile !== undefined && (
        <Button data-testid="warehouse-import-back-to-file" onClick={onChooseFile} variant="secondary">
          {t('dataImport.backToFile')}
        </Button>
      )}
      {isConflicted && !hasStaleTopology && (
        <Button onClick={reload} variant="secondary">{t('dataImport.refresh')}</Button>
      )}
      {fieldErrors.length > 0 && (
        <ul className="space-y-1 text-sm" role="alert">
          {fieldErrors.map((error, index) => (
            <li key={`${String(index)}:${error.fieldPath}`}>{formatImportIssue(options, mainT, template, error)}</li>
          ))}
        </ul>
      )}
    </div>
  );
};
