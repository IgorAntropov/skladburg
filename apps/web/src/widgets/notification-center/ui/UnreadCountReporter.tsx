import type {
  ComponentType,
  ReactElement,
} from 'react';

import {
  useEffect,
  useState,
} from 'react';

import { createCachedModuleLoader } from '@/shared/lib/module-loader';

import { loadUnreadCountReporter } from './loadUnreadCountReporter';

const loadCachedReporter = createCachedModuleLoader(loadUnreadCountReporter);

export const UnreadCountReporter = (): null | ReactElement => {
  const [Body, setBody] = useState<ComponentType | undefined>(() => loadCachedReporter.peekLoadedModule()?.UnreadCountReporterBody);

  useEffect(() => {
    let isCancelled = false;

    void loadCachedReporter().then(
      (loadedModule) => {
        if (!isCancelled) {
          setBody(() => loadedModule.UnreadCountReporterBody);
        }
      },
      (error: unknown) => {
        console.log('> UnreadCountReporter -> load:', { error });
      },
    );

    return (): void => {
      isCancelled = true;
    };
  }, []);

  return Body === undefined ? null : <Body />;
};
