import {
  useContext,
  useSyncExternalStore,
} from 'react';

import type { I18nSnapshotValue } from '../localizer/localizationTypes';

import { LocalizerContext } from './LocalizerContext';

export const useI18n = (): I18nSnapshotValue => {
  const localizer = useContext(LocalizerContext);

  if (localizer === undefined) {
    throw new Error('useI18n must be used inside LocalizerProvider');
  }

  return useSyncExternalStore(localizer.subscribe, localizer.getSnapshot);
};
