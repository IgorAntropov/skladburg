import type {
  ComponentType,
  ReactElement,
} from 'react';

import {
  useEffect,
  useState,
} from 'react';

import { createCachedModuleLoader } from '@/shared/lib/module-loader';

import type { AssistantHostProps } from './host/AssistantHost';

import { loadAssistantHost } from './loadAssistantHost';

export type AssistantLauncherProps = AssistantHostProps;

const loadCachedHost = createCachedModuleLoader(loadAssistantHost);

export const AssistantLauncher = ({ isPanelOpen, onOpenCenter }: AssistantLauncherProps): null | ReactElement => {
  const [Host, setHost] = useState<ComponentType<AssistantHostProps> | undefined>(() => loadCachedHost.peekLoadedModule()?.AssistantHost);

  useEffect(() => {
    let isCancelled = false;

    void loadCachedHost().then(
      (loadedModule) => {
        if (!isCancelled) {
          setHost(() => loadedModule.AssistantHost);
        }
      },
      (error: unknown) => {
        console.log('> AssistantLauncher -> load:', { error });
      },
    );

    return (): void => {
      isCancelled = true;
    };
  }, []);

  return Host === undefined ? null : <Host isPanelOpen={isPanelOpen} onOpenCenter={onOpenCenter} />;
};
