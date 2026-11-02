import type { ReactElement } from 'react';

import { useI18n } from '@/shared/i18n';

interface CatalogHeadingProps {
  description: string | undefined;
}

const ROOT_CLASS_NAME = 'flex flex-col gap-2';

const TITLE_CLASS_NAME = 'text-2xl font-semibold tracking-tight text-balance';

const DESCRIPTION_CLASS_NAME = 'max-w-prose text-base text-pretty text-on-panel-muted';

export const CatalogHeading = ({ description }: CatalogHeadingProps): ReactElement => {
  const { t } = useI18n();

  return (
    <div className={ROOT_CLASS_NAME}>
      <h1 className={TITLE_CLASS_NAME}>{t('section.catalog.title')}</h1>
      {description !== undefined && <p className={DESCRIPTION_CLASS_NAME}>{description}</p>}
    </div>
  );
};
