import { useContext } from 'react';

import type { SectionRetryFunction } from './SectionRetryContext';

import { SectionRetryContext } from './SectionRetryContext';

export const useSectionRetry = (): SectionRetryFunction => useContext(SectionRetryContext);
