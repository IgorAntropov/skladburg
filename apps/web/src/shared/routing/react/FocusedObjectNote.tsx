import type { ReactElement } from 'react';

import { useI18n } from '@/shared/i18n';

import type { ObjectRefValue } from '../address/addressTypes';

interface FocusedObjectNoteProps {
  focus: ObjectRefValue;
}

export const FocusedObjectNote = ({ focus }: FocusedObjectNoteProps): ReactElement => {
  const { t } = useI18n();

  return (
    <p className="text-base">
      {t('routing.focusedObject', { type: t(`object.type.${focus.type}`) })}
      {' '}
      <span translate="no">{focus.id}</span>
    </p>
  );
};
