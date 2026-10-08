import { useLayoutEffect } from 'react';

interface PendingSignalProps {
  onPendingChange: (isPending: boolean) => void;
}

export const PendingSignal = ({ onPendingChange }: PendingSignalProps): null => {
  useLayoutEffect(() => {
    onPendingChange(true);

    return (): void => {
      onPendingChange(false);
    };
  }, [onPendingChange]);

  return null;
};
