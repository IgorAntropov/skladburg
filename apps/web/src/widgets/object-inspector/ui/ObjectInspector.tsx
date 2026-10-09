import type { ReactElement } from 'react';

import {
  MousePointerClick,
  X,
} from 'lucide-react';

import type { ObjectRefValue } from '@/shared/routing';

import { useI18n } from '@/shared/i18n';
import { Button } from '@/shared/ui';

export interface ObjectInspectorProps {
  focus: ObjectRefValue | undefined;
  onClose: () => void;
}

const ROOT_CLASS_NAME = 'flex flex-1 flex-col gap-3';

const HEADER_CLASS_NAME = 'flex min-h-9 items-center justify-between gap-2';

const TITLE_CLASS_NAME = 'text-lg font-semibold tracking-tight';

const CLOSE_CLASS_NAME = '-my-1 -mr-2 shrink-0';

const OBJECT_CLASS_NAME = 'text-base';

const IDENTIFIER_CLASS_NAME = [
  'mt-2 block rounded-control border border-line bg-panel-solid px-3 py-2',
  'font-mono text-sm break-all',
].join(' ');

const EMPTY_CLASS_NAME = 'flex flex-1 flex-col items-center justify-center gap-3 text-center';

const EMPTY_ICON_CLASS_NAME = 'flex size-10 shrink-0 items-center justify-center rounded-full bg-hover text-on-panel-muted';

const EMPTY_TEXT_CLASS_NAME = 'max-w-80 text-base text-pretty text-on-panel-muted @xl:max-w-none';

export const ObjectInspector = ({ focus, onClose }: ObjectInspectorProps): ReactElement => {
  const { t } = useI18n();

  const handleCloseClick = (): void => {
    console.log('> ObjectInspector -> handleCloseClick:', { focus });
    onClose();
  };

  return (
    <div className={ROOT_CLASS_NAME}>
      <div className={HEADER_CLASS_NAME}>
        <h2 className={TITLE_CLASS_NAME}>{t('hud.inspector.title')}</h2>
        {focus !== undefined && (
          <Button className={CLOSE_CLASS_NAME} onClick={handleCloseClick} variant="ghost">
            <X aria-hidden className="size-4" />
            {t('hud.inspector.close')}
          </Button>
        )}
      </div>
      {focus === undefined
        ? (
            <div className={EMPTY_CLASS_NAME}>
              <span aria-hidden className={EMPTY_ICON_CLASS_NAME}>
                <MousePointerClick className="size-5" />
              </span>
              <p className={EMPTY_TEXT_CLASS_NAME}>{t('hud.inspector.empty')}</p>
            </div>
          )
        : (
            <p className={OBJECT_CLASS_NAME}>
              {t('hud.inspector.object', { type: t(`object.type.${focus.type}`) })}
              {' '}
              <span className={IDENTIFIER_CLASS_NAME} translate="no">{focus.id}</span>
            </p>
          )}
    </div>
  );
};
