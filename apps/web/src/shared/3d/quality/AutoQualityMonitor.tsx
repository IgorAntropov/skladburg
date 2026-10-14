import { addAfterEffect } from '@react-three/fiber';
import {
  useEffect,
  useRef,
  useState,
} from 'react';

import type { QualityLevelValue } from './qualityLevel';

import { IDLE_GAP_MS } from './autoQualityConstants';
import { createAutoQualityController } from './createAutoQualityController';

interface AutoQualityMonitorProps {
  ceiling: QualityLevelValue;
  changeCount: number;
  level: QualityLevelValue;
  onLevelChange: (level: QualityLevelValue) => void;
}

export const AutoQualityMonitor = ({
  ceiling,
  changeCount,
  level,
  onLevelChange,
}: AutoQualityMonitorProps): null => {
  const [controller] = useState(() => createAutoQualityController({ ceiling, changeCount, level }));
  const onLevelChangeRef = useRef(onLevelChange);

  useEffect(() => {
    onLevelChangeRef.current = onLevelChange;
  }, [onLevelChange]);

  useEffect(() => {
    controller.sync({ ceiling, changeCount, level });
  }, [ceiling, changeCount, controller, level]);

  useEffect(() => {
    let lastFrameMs = 0;
    let idleTimerId: ReturnType<typeof setTimeout> | undefined;

    const handleIdleCheck = (): void => {
      const idleMs = performance.now() - lastFrameMs;

      if (idleMs < IDLE_GAP_MS) {
        idleTimerId = setTimeout(handleIdleCheck, IDLE_GAP_MS - idleMs);

        return;
      }

      idleTimerId = undefined;

      const change = controller.finishSeries();

      if (change === undefined) {
        return;
      }

      console.log('> AutoQualityMonitor -> changeLevel:', change);
      onLevelChangeRef.current(change.to);
    };

    const unsubscribe = addAfterEffect((timestampMs) => {
      lastFrameMs = timestampMs;
      controller.recordFrame(timestampMs);

      idleTimerId ??= setTimeout(handleIdleCheck, IDLE_GAP_MS);
    });

    return () => {
      unsubscribe();

      if (idleTimerId !== undefined) {
        clearTimeout(idleTimerId);
        idleTimerId = undefined;
      }
    };
  }, [controller]);

  return null;
};
