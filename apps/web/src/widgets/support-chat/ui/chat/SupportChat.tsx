import type { ReactElement } from 'react';

import type { SupportChatLauncherProps } from '../SupportChatLauncher';

import { useSupportTexts } from '../../model/useSupportTexts';
import { SupportChatContent } from './SupportChatContent';

export const SupportChat = ({ loadingFallback, renderLoadError }: SupportChatLauncherProps): ReactElement => {
  const { retry, status, t } = useSupportTexts();

  if (t === undefined) {
    return <>{status === 'error' ? renderLoadError(retry) : loadingFallback}</>;
  }

  return <SupportChatContent t={t} />;
};
