import type { ReactElement } from 'react';

import {
  Eye,
  PencilLine,
} from 'lucide-react';

import { useCatalogSection } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';

import { listingSection } from '../i18n/listingSection';

interface PublicationBadgeProps {
  isPublished: boolean;
}

const BASE_CLASS_NAME = 'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-sm leading-5 font-medium whitespace-nowrap';

const PUBLISHED_CLASS_NAME = 'border-transparent bg-status-ok text-on-status-ok';

const DRAFT_CLASS_NAME = 'border-line-strong text-on-panel';

export const PublicationBadge = ({ isPublished }: PublicationBadgeProps): ReactElement | undefined => {
  const { t } = useCatalogSection(listingSection);

  if (t === undefined) {
    return undefined;
  }

  const Icon = isPublished ? Eye : PencilLine;

  return (
    <span
      className={cn(BASE_CLASS_NAME, isPublished ? PUBLISHED_CLASS_NAME : DRAFT_CLASS_NAME)}
      data-publication={isPublished ? 'published' : 'draft'}
    >
      <Icon aria-hidden className="size-4 shrink-0" />
      {isPublished ? t('listing.publication.published') : t('listing.publication.draft')}
    </span>
  );
};
