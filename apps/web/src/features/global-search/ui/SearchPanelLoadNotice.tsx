import type {
  MouseEvent,
  ReactElement,
} from 'react';

import { TriangleAlert } from 'lucide-react';

import { useI18n } from '@/shared/i18n';
import { Button } from '@/shared/ui';

const NOTICE_CLASS_NAME = [
  'absolute top-full right-0 z-20 mt-2 flex w-72 max-w-[calc(100vw-2rem)] flex-col items-start gap-3',
  'rounded-panel border border-line bg-panel-solid p-4 text-on-panel shadow-raised',
  'xl:right-auto xl:left-0 max-sm:right-3 max-sm:left-3 max-sm:w-auto max-sm:max-w-none',
].join(' ');

const BADGE_CLASS_NAME = 'flex size-6 shrink-0 items-center justify-center rounded-full bg-status-alarm text-on-status-alarm';

export interface SearchPanelLoadNoticeProps {
  isRepeated: boolean;
  onRetry: () => void;
}

export const SearchPanelLoadNotice = ({ isRepeated, onRetry }: SearchPanelLoadNoticeProps): ReactElement => {
  const { t } = useI18n();

  const handleMouseDown = (event: MouseEvent<HTMLDivElement>): void => {
    event.preventDefault();
  };

  const handleRetryClick = (): void => {
    console.log('> SearchPanelLoadNotice -> handleRetryClick:', {});
    onRetry();
  };

  return (
    <div className={NOTICE_CLASS_NAME} onMouseDown={handleMouseDown}>
      <div className="flex items-start gap-2">
        <span aria-hidden className={BADGE_CLASS_NAME}>
          <TriangleAlert className="size-4" />
        </span>
        <p className="text-base leading-6" role="alert">
          {isRepeated ? t('search.loadError.repeated') : t('search.loadError.message')}
        </p>
      </div>
      <Button onClick={handleRetryClick} variant="secondary">{t('common.retry')}</Button>
    </div>
  );
};
