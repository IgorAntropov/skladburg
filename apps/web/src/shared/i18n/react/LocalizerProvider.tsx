import type {
  ReactElement,
  ReactNode,
} from 'react';

import type { ILocalizer } from '../localizer/localizationTypes';

import { LocalizerContext } from './LocalizerContext';

interface LocalizerProviderProps {
  children: ReactNode;
  localizer: ILocalizer;
}

export const LocalizerProvider = ({ children, localizer }: LocalizerProviderProps): ReactElement => {
  return <LocalizerContext value={localizer}>{children}</LocalizerContext>;
};
