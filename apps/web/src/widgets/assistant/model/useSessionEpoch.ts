import {
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  getTabStorage,
  useActingContext,
  useDemoControl,
} from '@/shared/api';

import { clearDigestMarks } from '../lib/digestMarks';

export interface SessionEpochValue {
  count: number;
  startedAtMs: number;
}

const FIRST_EPOCH: SessionEpochValue = { count: 0, startedAtMs: 0 };

export const useSessionEpoch = (): SessionEpochValue => {
  const { organizationId, userId } = useActingContext();
  const demoControl = useDemoControl();
  const [epoch, setEpoch] = useState(FIRST_EPOCH);
  const contextKey = `${userId ?? ''}:${organizationId ?? ''}`;
  const lastContextKeyRef = useRef(contextKey);

  useEffect(() => {
    if (lastContextKeyRef.current === contextKey) {
      return;
    }

    console.log('> useSessionEpoch -> contextChanged:', { contextKey });
    lastContextKeyRef.current = contextKey;
    setEpoch(current => ({ count: current.count + 1, startedAtMs: Date.now() }));
  }, [contextKey]);

  useEffect(() => {
    return demoControl?.onReset((demoEpoch) => {
      console.log('> useSessionEpoch -> demoReset:', { demoEpoch });
      clearDigestMarks(getTabStorage(window));
      setEpoch(current => ({ count: current.count + 1, startedAtMs: Date.now() }));
    });
  }, [demoControl]);

  return epoch;
};
