import { useEffect } from 'react';

import type { CachedModuleLoader } from '@/shared/lib/module-loader';

export const usePrewarmedModule = <TModule>(loader: CachedModuleLoader<TModule>): void => {
  useEffect(() => {
    loader().catch((error: unknown) => {
      console.log('> usePrewarmedModule -> load:', { error });
    });
  }, [loader]);
};
