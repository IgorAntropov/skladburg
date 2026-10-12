import { createContext } from 'react';

import type { AppSectionValue } from '@/shared/routing';

export type SectionRetryFunction = (section: AppSectionValue) => void;

const NO_SECTION_RETRY: SectionRetryFunction = () => undefined;

export const SectionRetryContext = createContext<SectionRetryFunction>(NO_SECTION_RETRY);
