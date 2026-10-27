import type {
  ComponentType,
  ReactElement,
} from 'react';

import { Suspense } from 'react';

import type { CachedModuleLoader } from '@/shared/lib/module-loader';

import { createLazyComponent } from '@/shared/lib/module-loader';

import { AppUpdateNoticeBoundary } from './AppUpdateNoticeBoundary';
import { AppUpdateNoticeFallback } from './AppUpdateNoticeFallback';
import { isAppUpdateNoticeVisible } from './appUpdateNoticeState';
import { useAppUpdate } from './useAppUpdate';

export interface AppUpdateNoticePanelModuleValue {
  default: ComponentType;
}

export const createAppUpdateNotice = (
  loadPanel: CachedModuleLoader<AppUpdateNoticePanelModuleValue>,
): () => null | ReactElement => {
  const LazyPanel = createLazyComponent(loadPanel);

  const AppUpdateNotice = (): null | ReactElement => {
    const { state } = useAppUpdate();

    if (!isAppUpdateNoticeVisible(state)) {
      return null;
    }

    return (
      <AppUpdateNoticeBoundary fallback={<AppUpdateNoticeFallback />}>
        <Suspense fallback={null}>
          <LazyPanel />
        </Suspense>
      </AppUpdateNoticeBoundary>
    );
  };

  return AppUpdateNotice;
};
