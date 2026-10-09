import type { ReactElement } from 'react';

import { LocalizerProvider } from '../react/LocalizerProvider';
import { createTestLocalizer } from './createTestLocalizer';

const localizer = await createTestLocalizer();

export const withTestLocalizer = (node: ReactElement): ReactElement => {
  return <LocalizerProvider localizer={localizer}>{node}</LocalizerProvider>;
};
