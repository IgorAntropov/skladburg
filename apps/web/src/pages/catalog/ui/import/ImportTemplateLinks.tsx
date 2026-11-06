import type { ImportTemplate } from '@skladburg/contracts/import/v1/import';
import type { ReactElement } from 'react';

import { buttonClassName } from '@/shared/ui';

import type { ImportTranslate } from '../../i18n/import/importSection';

interface ImportTemplateLinksProps {
  t: ImportTranslate;
  template: ImportTemplate;
}

const makeCsvLink = (template: ImportTemplate): string => {
  const header = template.columns.map(column => column.key).join(';');
  return `data:text/csv;charset=utf-8,${encodeURIComponent(`\uFEFF${header}\r\n`)}`;
};

export const ImportTemplateLinks = ({ t, template }: ImportTemplateLinksProps): ReactElement => (
  <div className="flex flex-wrap gap-2">
    <a
      className={buttonClassName({ variant: 'secondary' })}
      data-testid="catalog-import-template-csv"
      download="catalog-template.csv"
      href={makeCsvLink(template)}
    >
      {t('catalogImport.csv')}
    </a>
    <a
      className={buttonClassName({ variant: 'secondary' })}
      data-testid="catalog-import-template-xlsx"
      download="catalog-template.xlsx"
      href={`${import.meta.env.BASE_URL}templates/catalog-template.xlsx`}
    >
      {t('catalogImport.xlsx')}
    </a>
  </div>
);
