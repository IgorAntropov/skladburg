import { useEffect } from 'react';

import { resolveCameraHotkey } from '../lib/resolveCameraHotkey';
import { useSceneCameraStore } from './useSceneCameraStore';

export const useSceneCameraHotkeys = (): void => {
  const sendCommand = useSceneCameraStore(state => state.sendCommand);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      const command = resolveCameraHotkey(event);

      if (command === undefined) {
        return;
      }

      event.preventDefault();
      sendCommand(command);
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [sendCommand]);
};
