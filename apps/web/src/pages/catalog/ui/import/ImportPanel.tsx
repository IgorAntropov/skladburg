import type { ImportRow } from '@skladburg/contracts/import/v1/import';
import type { ReactElement } from 'react';

import {
  ImportPanelFrame,
  ImportWorkspace,
} from '@/features/data-import';
import {
  useCatalogSection,
  useI18n,
} from '@/shared/i18n';
import { formatMoney } from '@/shared/lib/money';
import {
  Button,
  Skeleton,
} from '@/shared/ui';

import { useCatalogImportAccess } from '../../api/import/useCatalogImportAccess';
import {
  findCatalogImportRuleKey,
  importSection,
} from '../../i18n/import/importSection';

interface ImportPanelProps {
  onClose: () => void;
}

export const ImportPanel = ({ onClose }: ImportPanelProps): ReactElement => {
  const { locale, t: mainT } = useI18n();
  const { retry, status, t } = useCatalogSection(importSection);
  const { readAccess, writeAccess } = useCatalogImportAccess();

  const formatRow = (row: ImportRow): string | undefined => {
    const { product } = row;
    if (product === undefined) {
      return undefined;
    }

    const price = row.price?.tiers[0]?.price;
    const priceText = price === undefined ? '' : ` · ${formatMoney(locale, price)}`;

    return `${product.name} · ${product.sku}${priceText}`;
  };

  const getRuleMessage = (ruleId: string): string | undefined => {
    const key = findCatalogImportRuleKey(locale, ruleId);

    return key === undefined ? undefined : t?.(key);
  };

  return (
    <ImportPanelFrame
      closeLabel={t?.('dataImport.back') ?? mainT('hud.inspector.close')}
      kind="catalog"
      onClose={onClose}
      title={t?.('dataImport.title') ?? mainT('routing.section.loading')}
    >
      {status === 'loading' && <Skeleton className="h-20 w-full" />}
      {status === 'error' && (
        <div className="flex flex-col items-start gap-2">
          <p role="alert">{mainT('routing.chunkError.message')}</p>
          <Button onClick={retry} variant="secondary">{mainT('common.retry')}</Button>
        </div>
      )}
      {t !== undefined && (
        <ImportWorkspace options={{ formatRow, getRuleMessage, t, target: { kind: 'catalog' }, writeAccess }} readAccess={readAccess} />
      )}
    </ImportPanelFrame>
  );
};
