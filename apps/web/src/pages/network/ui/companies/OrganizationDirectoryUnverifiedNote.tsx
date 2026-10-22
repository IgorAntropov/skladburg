import type { ReactElement } from 'react';

import { ShieldQuestionMark } from 'lucide-react';

import { useI18n } from '@/shared/i18n';

export const OrganizationDirectoryUnverifiedNote = (): ReactElement => {
  const { t } = useI18n();

  return (
    <p
      className="flex items-start gap-2 rounded-control bg-hover p-3 text-sm leading-5 text-on-panel-muted"
      data-testid="organization-directory-unverified"
    >
      <ShieldQuestionMark aria-hidden className="mt-0.5 size-4 shrink-0" />
      <span>{t('organization.directory.unverified')}</span>
    </p>
  );
};
