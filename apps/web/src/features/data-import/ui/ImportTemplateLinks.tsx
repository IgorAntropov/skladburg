import type { ImportTemplate } from '@skladburg/contracts/import/v1/import';
import type { ReactElement } from 'react';

import { buttonClassName } from '@/shared/ui';

import type { ImportOptionsValue } from '../model/importOptions';

interface ImportTemplateLinksProps {
  options: ImportOptionsValue;
  template: ImportTemplate;
}

const makeCsvLink = (template: ImportTemplate): string => {
  const header = template.columns.map(column => column.key).join(';');
  return `data:text/csv;charset=utf-8,${encodeURIComponent(`\uFEFF${header}\r\n`)}`;
};

export const ImportTemplateLinks = ({ options: { t, target }, template }: ImportTemplateLinksProps): ReactElement => {
  const fileName = target.kind === 'catalog'
    ? 'catalog-template.xlsx'
    : target.templateId === 'warehouse_cells' ? 'warehouse-cells-template.xlsx' : 'opening-stock-template.xlsx';

  return (
    <div className="flex flex-wrap gap-2">
      {target.kind === 'catalog' && (
        <a
          className={buttonClassName({ variant: 'secondary' })}
          data-testid="catalog-import-template-csv"
          download="catalog-template.csv"
          href={makeCsvLink(template)}
        >
          {t('dataImport.csv')}
        </a>
      )}
      <a
        className={buttonClassName({ variant: 'secondary' })}
        data-testid={`${target.kind}-import-template-xlsx`}
        download={fileName}
        href={`${import.meta.env.BASE_URL}templates/${fileName}`}
      >
        {t('dataImport.xlsx')}
      </a>
    </div>
  );
};
