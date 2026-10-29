import type {
  ComponentType,
  ReactElement,
  ReactNode,
} from 'react';

import {
  useEffect,
  useState,
} from 'react';

import { createCachedModuleLoader } from '@/shared/lib/module-loader';

import { loadSupportChat } from './loadSupportChat';

export interface SupportChatLauncherProps {
  loadingFallback: ReactNode;
  renderLoadError: (onRetry: () => void) => ReactNode;
}

const loadCachedChat = createCachedModuleLoader(loadSupportChat);

export const SupportChatLauncher = ({ loadingFallback, renderLoadError }: SupportChatLauncherProps): ReactElement => {
  const [Chat, setChat] = useState<ComponentType<SupportChatLauncherProps> | undefined>(
    () => loadCachedChat.peekLoadedModule()?.SupportChat,
  );
  const [attempt, setAttempt] = useState(0);
  const [isFailed, setIsFailed] = useState(false);

  const handleRetry = (): void => {
    console.log('> SupportChatLauncher -> handleRetry:', { attempt });
    setIsFailed(false);
    setAttempt(current => current + 1);
  };

  useEffect(() => {
    let isCancelled = false;

    void loadCachedChat().then(
      (loadedModule) => {
        if (!isCancelled) {
          setChat(() => loadedModule.SupportChat);
        }
      },
      (error: unknown) => {
        console.log('> SupportChatLauncher -> load:', { error });
        if (!isCancelled) {
          setIsFailed(true);
        }
      },
    );

    return (): void => {
      isCancelled = true;
    };
  }, [attempt]);

  if (Chat !== undefined) {
    return <Chat loadingFallback={loadingFallback} renderLoadError={renderLoadError} />;
  }

  return <>{isFailed ? renderLoadError(handleRetry) : loadingFallback}</>;
};
