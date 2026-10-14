import { useInstallApp } from './useInstallApp';

export const useIsInstallAppAvailable = (): boolean => {
  const { mode } = useInstallApp();

  return mode === 'instructions' || mode === 'prompt';
};
