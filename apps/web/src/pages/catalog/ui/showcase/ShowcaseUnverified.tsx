import type { ReactElement } from 'react';

import { AssistantPortrait } from '@/entities/assistant';
import { useActingContext } from '@/shared/api';
import { AddressLink } from '@/shared/routing';
import {
  buttonClassName,
  EmptyState,
} from '@/shared/ui';

import { useCatalogTexts } from '../../model/useCatalogTexts';

const LINK_CLASS_NAME = buttonClassName({ variant: 'secondary' });

export const ShowcaseUnverified = (): ReactElement => {
  const { t } = useCatalogTexts();
  const { organizationId } = useActingContext();

  return (
    <EmptyState
      action={organizationId === undefined
        ? undefined
        : (
            <AddressLink
              className={LINK_CLASS_NAME}
              to={{ kind: 'object', object: { id: organizationId, type: 'organization' } }}
            >
              {t('catalog.empty.unverified.action')}
            </AddressLink>
          )}
      className="py-8"
      data-testid="catalog-empty-unverified"
      hint={t('catalog.empty.unverified.hint')}
      media={<AssistantPortrait size="sm" />}
      text={t('catalog.empty.unverified.text')}
    />
  );
};
