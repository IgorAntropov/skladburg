import type { SalesTerms } from '@skladburg/contracts/catalog/v1/catalog';
import type { ReactElement } from 'react';

import { useSalesTermsQuery } from '@/entities/listing';
import { useAnnounce } from '@/shared/ui';

import type { EditSnapshotValue } from '../../model/useEditBaseline';
import type { SalesTermsFormProps } from './SalesTermsForm';

import { useListingCache } from '../../api/useListingCache';
import { useEditBaseline } from '../../model/useEditBaseline';
import { useEditorTexts } from '../../model/useEditorTexts';
import { SalesTermsFields } from './SalesTermsFields';

export const SalesTermsFormContent = ({ onClose, terms }: SalesTermsFormProps): ReactElement => {
  const t = useEditorTexts();
  const announce = useAnnounce();
  const cache = useListingCache();
  const { refetch } = useSalesTermsQuery();

  const refetchTerms = async (): Promise<EditSnapshotValue<SalesTerms> | undefined> => {
    const result = await refetch();

    return result.isSuccess ? { record: result.data } : undefined;
  };

  const handleReloaded = (): void => {
    announce(t('catalogEditor.terms.reloaded'));
  };

  const { baseline, epoch, isReloading, reload } = useEditBaseline<SalesTerms>({
    initial: terms,
    onReloaded: handleReloaded,
    refetch: refetchTerms,
  });

  const handleSaved = (saved: SalesTerms): void => {
    console.log('> SalesTermsFormContent -> handleSaved:', { version: String(saved.version) });
    cache.storeSalesTerms(saved);
    onClose();
  };

  return (
    <SalesTermsFields
      isReloading={isReloading}
      key={epoch}
      onClose={onClose}
      onReload={reload}
      onSaved={handleSaved}
      terms={baseline}
    />
  );
};
