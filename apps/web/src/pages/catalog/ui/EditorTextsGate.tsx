import type {
  ReactElement,
  ReactNode,
} from 'react';

import {
  useCatalogSection,
  useI18n,
} from '@/shared/i18n';
import {
  Button,
  SkeletonGroup,
  useDelayedVisibility,
} from '@/shared/ui';

import { catalogEditorSection } from '../i18n/editor/editorSection';
import { EditorTextsContext } from '../model/editorTextsContext';

interface EditorTextsGateProps {
  children: ReactNode;
  skeleton: ReactNode;
}

export const EditorTextsGate = ({ children, skeleton }: EditorTextsGateProps): ReactElement => {
  const { t: mainT } = useI18n();
  const { retry, status, t } = useCatalogSection(catalogEditorSection);

  const isFailed = status === 'error';
  const isSkeletonFilled = useDelayedVisibility(t === undefined && !isFailed);

  const handleRetryClick = (): void => {
    console.log('> EditorTextsGate -> handleRetryClick:', { status });
    retry();
  };

  if (t !== undefined) {
    return <EditorTextsContext value={t}>{children}</EditorTextsContext>;
  }

  if (isFailed) {
    return (
      <div className="flex max-w-prose flex-col items-start gap-3">
        <p className="text-base leading-6" role="alert">{mainT('routing.chunkError.message')}</p>
        <Button onClick={handleRetryClick} variant="secondary">{mainT('common.retry')}</Button>
      </div>
    );
  }

  return <SkeletonGroup isFilled={isSkeletonFilled} label={mainT('routing.section.loading')}>{skeleton}</SkeletonGroup>;
};
