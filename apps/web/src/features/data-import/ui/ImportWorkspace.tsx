import type { ImportJob } from '@skladburg/contracts/import/v1/import';
import type {
  ReactElement,
  ReactNode,
} from 'react';

import {
  useRef,
  useState,
} from 'react';

import type { CommandAccessValue } from '@/shared/api';

import { getPermissionMessageKey } from '@/shared/api';
import { useI18n } from '@/shared/i18n';
import {
  ActionButton,
  FileButton,
  Skeleton,
  WidgetStates,
} from '@/shared/ui';

import type { ImportOptionsValue } from '../model/importOptions';

import { useImportReadAccess } from '../api/useImportAccess';
import {
  useImportScope,
  useImportTemplate,
} from '../api/useImportQueries';
import { usePreviewImport } from '../api/usePreviewImport';
import { ImportHistory } from './ImportHistory';
import { ImportPreview } from './ImportPreview';
import { ImportTemplateLinks } from './ImportTemplateLinks';

interface ImportContentProps {
  instructions?: ReactNode;
  options: ImportOptionsValue;
}

interface ImportWorkspaceProps extends ImportContentProps {
  readAccess: CommandAccessValue;
}

const ImportContent = ({ instructions, options }: ImportContentProps): ReactElement => {
  const { t, target } = options;
  const template = useImportTemplate(target);
  const fileButtonRef = useRef<HTMLButtonElement>(null);
  const [selected, setSelected] = useState<ImportJob | undefined>(undefined);
  const { access, command, fileError, fileName, isReading, selectFile } = usePreviewImport(options, setSelected);

  const handleChooseFile = (): void => {
    fileButtonRef.current?.focus();
  };

  const handleSelect = (file: File): void => {
    setSelected(undefined);
    selectFile(file);
  };

  const handleSelectJob = (job: ImportJob): void => {
    setSelected(job);
  };

  const handleUpdate = (job: ImportJob): void => {
    setSelected(prev => prev?.id === job.id ? job : prev);
  };

  const handleRetry = (): void => {
    void template.refetch();
  };

  const fileCommand = { ...command, error: null, isPending: isReading || command.isPending };
  const errorMessage = fileError === undefined ? undefined : t(`dataImport.file.${fileError}`);

  return (
    <>
      <p className="text-sm text-on-panel-muted">{t('dataImport.format')}</p>
      {instructions}
      <WidgetStates
        data={template.data}
        error={template.error}
        isRetrying={template.isFetching}
        loadingLabel={t('dataImport.loading')}
        onRetry={handleRetry}
        skeleton={<Skeleton className="h-11 w-56 max-w-full" />}
      >
        {data => <ImportTemplateLinks options={options} template={data} />}
      </WidgetStates>
      <div className="flex min-w-0 flex-wrap items-start gap-2">
        <FileButton
          accept={target.kind === 'catalog' ? '.csv,.xlsx' : '.xlsx'}
          access={access}
          buttonRef={fileButtonRef}
          command={fileCommand}
          data-testid={`${target.kind}-import-file`}
          errorMessage={errorMessage}
          onFileSelect={handleSelect}
          pendingLabel={t('dataImport.reading')}
          variant="secondary"
        >
          {t('dataImport.choose')}
        </FileButton>
        {fileName !== undefined && (
          <div className="flex min-w-0 flex-col items-start gap-2">
            <ActionButton access={access} command={command} data-testid={`${target.kind}-import-preview`} variant="primary">
              {t('dataImport.preview')}
            </ActionButton>
            <p aria-live="polite" className="text-sm wrap-anywhere text-on-panel-muted">{fileName}</p>
          </div>
        )}
      </div>
      {selected !== undefined && (
        <ImportPreview
          job={selected}
          key={selected.id}
          onChooseFile={handleChooseFile}
          onUpdate={handleUpdate}
          options={options}
          template={template.data}
        />
      )}
      <ImportHistory onSelect={handleSelectJob} onUpdate={handleUpdate} options={options} template={template.data} />
    </>
  );
};

export const ImportWorkspace = ({ instructions, options, readAccess }: ImportWorkspaceProps): ReactElement => {
  const { t: mainT } = useI18n();
  const { t, target } = options;
  const scope = useImportScope(target);
  const access = useImportReadAccess(readAccess);

  if (access.status === 'checking') {
    return <Skeleton className="h-20 w-full" />;
  }

  if (access.status === 'denied') {
    const permissionKey = getPermissionMessageKey(access.permission);

    return (
      <p role="status">
        {permissionKey === undefined
          ? mainT('error.permission_denied.unnamed')
          : t('dataImport.noAccess', { permission: mainT(permissionKey) })}
      </p>
    );
  }

  return <ImportContent instructions={instructions} key={JSON.stringify(scope)} options={options} />;
};
