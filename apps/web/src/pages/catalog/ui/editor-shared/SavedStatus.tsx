import type { ReactElement } from 'react';

import { CircleCheck } from 'lucide-react';

import { useEditorTexts } from '../../model/useEditorTexts';

export const SavedStatus = (): ReactElement => {
  const t = useEditorTexts();

  return (
    <p className="flex items-center gap-1 text-sm leading-5 text-on-panel" role="status">
      <CircleCheck aria-hidden className="size-4 shrink-0" />
      {t('catalogEditor.savedStatus')}
    </p>
  );
};
