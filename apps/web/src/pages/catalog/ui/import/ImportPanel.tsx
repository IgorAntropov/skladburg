import type { ImportJob } from '@skladburg/contracts/import/v1/import';
import type { ReactElement } from 'react';

import { useState } from 'react';

import {
  getPermissionMessageKey,
  useActingContext,
} from '@/shared/api';
import {
  useCatalogSection,
  useI18n,
} from '@/shared/i18n';
import {
  ActionButton,
  Button,
  FileButton,
  Skeleton,
  WidgetStates,
} from '@/shared/ui';

import type { ImportTranslate } from '../../i18n/import/importSection';

import {
  useImportReadAccess,
  useImportTemplate,
} from '../../api/import/useImportQueries';
import { usePreviewImport } from '../../api/import/usePreviewImport';
import { importSection } from '../../i18n/import/importSection';
import { ImportHistory } from './ImportHistory';
import { ImportPreview } from './ImportPreview';
import { ImportTemplateLinks } from './ImportTemplateLinks';

interface ImportPanelProps {
  onClose: () => void;
}

const ImportContent = ({ t }: { t: ImportTranslate }): ReactElement => {
  const template = useImportTemplate();
  const [selected, setSelected] = useState<ImportJob | undefined>(undefined);
  const { access, command, fileError, fileName, isReading, selectFile } = usePreviewImport(setSelected);

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
  const errorMessage = fileError === undefined ? undefined : t(`catalogImport.file.${fileError}`);

  return (
    <>
      <p className="text-sm text-on-panel-muted">{t('catalogImport.format')}</p>
      <WidgetStates
        data={template.data}
        error={template.error}
        isRetrying={template.isFetching}
        loadingLabel={t('catalogImport.loading')}
        onRetry={handleRetry}
        skeleton={<Skeleton className="h-11 w-56 max-w-full" />}
      >
        {data => <ImportTemplateLinks t={t} template={data} />}
      </WidgetStates>
      <div className="flex min-w-0 flex-wrap items-start gap-2">
        <FileButton
          accept=".csv,.xlsx"
          access={access}
          command={fileCommand}
          data-testid="catalog-import-file"
          errorMessage={errorMessage}
          onFileSelect={handleSelect}
          pendingLabel={t('catalogImport.reading')}
          variant="secondary"
        >
          {t('catalogImport.choose')}
        </FileButton>
        {fileName !== undefined && (
          <div className="flex min-w-0 flex-col items-start gap-2">
            <ActionButton access={access} command={command} data-testid="catalog-import-preview" variant="primary">
              {t('catalogImport.preview')}
            </ActionButton>
            <p aria-live="polite" className="text-sm wrap-anywhere text-on-panel-muted">{fileName}</p>
          </div>
        )}
      </div>
      {selected !== undefined && (
        <ImportPreview job={selected} key={selected.id} onUpdate={handleUpdate} t={t} template={template.data} />
      )}
      <ImportHistory onSelect={handleSelectJob} onUpdate={handleUpdate} t={t} template={template.data} />
    </>
  );
};

const handleFocus = (button: HTMLButtonElement | null): void => {
  button?.focus();
};

export const ImportPanel = ({ onClose }: ImportPanelProps): ReactElement => {
  const { t: mainT } = useI18n();
  const { organizationId, userId } = useActingContext();
  const { retry, status, t } = useCatalogSection(importSection);
  const access = useImportReadAccess();

  const permissionKey = access.status === 'denied' ? getPermissionMessageKey(access.permission) : undefined;
  const isLoading = status !== 'error' && (t === undefined || access.status === 'checking');
  const isContentShown = t !== undefined && access.status === 'allowed';

  return (
    <section className="flex min-w-0 flex-col gap-3 text-on-panel" data-testid="catalog-import-panel">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">{t?.('catalogImport.title') ?? mainT('routing.section.loading')}</h2>
        <Button data-testid="catalog-import-close" onClick={onClose} ref={handleFocus} variant="secondary">
          {t?.('catalogImport.back') ?? mainT('hud.inspector.close')}
        </Button>
      </div>
      {isLoading && <Skeleton className="h-20 w-full" />}
      {status === 'error' && (
        <div className="flex flex-col items-start gap-2">
          <p role="alert">{mainT('routing.chunkError.message')}</p>
          <Button onClick={retry} variant="secondary">{mainT('common.retry')}</Button>
        </div>
      )}
      {t !== undefined && access.status === 'denied' && (
        <p role="status">
          {permissionKey === undefined
            ? mainT('error.permission_denied.unnamed')
            : t('catalogImport.noAccess', { permission: mainT(permissionKey) })}
        </p>
      )}
      {isContentShown && <ImportContent key={`${organizationId ?? ''}:${userId ?? ''}`} t={t} />}
    </section>
  );
};
