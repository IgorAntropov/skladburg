import type {
  ReactElement,
  ReactNode,
} from 'react';

import { Pencil } from 'lucide-react';

import type { CommandAccessValue } from '@/shared/api';

import { AccessButton } from '@/shared/ui';

import type { GarageTranslate } from '../i18n/garageSection';

interface GarageRecordRowProps {
  access: CommandAccessValue;
  children?: ReactNode | undefined;
  onEdit: () => void;
  t: GarageTranslate;
  testId: string;
  title: string;
}

export const GarageRecordRow = ({
  access,
  children,
  onEdit,
  t,
  testId,
  title,
}: GarageRecordRowProps): ReactElement => {
  return (
    <article className="flex min-w-0 flex-col gap-2" data-testid={testId}>
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
        <h2 className="min-w-0 text-base font-semibold wrap-anywhere text-on-panel" translate="no">{title}</h2>
        <AccessButton
          access={access}
          aria-label={t('garage.actions.editRecord', { name: title })}
          data-testid={`${testId}-edit`}
          onClick={onEdit}
          variant="secondary"
        >
          <Pencil aria-hidden className="size-4" />
          {t('garage.actions.edit')}
        </AccessButton>
      </div>
      {children}
    </article>
  );
};
