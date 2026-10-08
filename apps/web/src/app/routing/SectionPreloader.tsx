import {
  useEffect,
  useState,
} from 'react';

import type { AppSectionValue } from '@/shared/routing';

import { APP_SECTIONS } from '@/shared/routing';

import type { CachedSectionLoadersValue } from './sectionPages';

import { scheduleWhenIdle } from '../lib/scheduleWhenIdle';

interface SectionPreloaderProps {
  loaders: CachedSectionLoadersValue;
  section: AppSectionValue | undefined;
}

export const SectionPreloader = ({ loaders, section }: SectionPreloaderProps): null => {
  const [initialSection] = useState(section);

  useEffect(() => {
    const preloadOtherSections = (): void => {
      for (const otherSection of APP_SECTIONS) {
        if (otherSection === initialSection) {
          continue;
        }

        Promise.resolve(loaders[otherSection]()).catch((error: unknown) => {
          console.error('> SectionPreloader -> preloadOtherSections:', { error, section: otherSection });
        });
      }
    };

    return scheduleWhenIdle(preloadOtherSections);
  }, [loaders, initialSection]);

  return null;
};
