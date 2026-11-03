import {
  useCallback,
  useState,
} from 'react';

export interface EditBaselineOptionsValue<TRecord> {
  initial: TRecord;
  onReloaded?: (() => void) | undefined;
  refetch: () => Promise<EditSnapshotValue<TRecord> | undefined>;
}

export interface EditBaselineValue<TRecord> {
  accept: (saved: TRecord) => void;
  baseline: TRecord;
  epoch: number;
  isReloading: boolean;
  reload: () => void;
}

export interface EditSnapshotValue<TRecord> {
  record: TRecord;
}

interface EditBaselineStateValue<TRecord> {
  baseline: TRecord;
  epoch: number;
}

export const useEditBaseline = <TRecord>({
  initial,
  onReloaded,
  refetch,
}: EditBaselineOptionsValue<TRecord>): EditBaselineValue<TRecord> => {
  const [state, setState] = useState<EditBaselineStateValue<TRecord>>(() => ({ baseline: initial, epoch: 0 }));
  const [isReloading, setIsReloading] = useState(false);

  const accept = useCallback((saved: TRecord): void => {
    console.log('> useEditBaseline -> accept:', {});
    setState(current => ({ ...current, baseline: saved }));
  }, []);

  const reload = (): void => {
    console.log('> useEditBaseline -> reload:', {});
    setIsReloading(true);
    void refetch().then((snapshot) => {
      setIsReloading(false);

      if (snapshot === undefined) {
        return;
      }

      setState(current => ({ baseline: snapshot.record, epoch: current.epoch + 1 }));
      onReloaded?.();
    });
  };

  return { accept, baseline: state.baseline, epoch: state.epoch, isReloading, reload };
};
