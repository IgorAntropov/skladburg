import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

export interface DebouncedTextValue {
  appliedText: string;
  reset: () => void;
  setText: (text: string) => void;
}

export const useDebouncedText = (delayMs: number): DebouncedTextValue => {
  const [appliedText, setAppliedText] = useState('');
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const cancelPending = useCallback((): void => {
    if (timerRef.current !== undefined) {
      clearTimeout(timerRef.current);
      timerRef.current = undefined;
    }
  }, []);

  const setText = useCallback((text: string): void => {
    cancelPending();
    timerRef.current = setTimeout(() => {
      timerRef.current = undefined;
      setAppliedText(text);
    }, delayMs);
  }, [cancelPending, delayMs]);

  const reset = useCallback((): void => {
    cancelPending();
    setAppliedText('');
  }, [cancelPending]);

  useEffect(() => cancelPending, [cancelPending]);

  return { appliedText, reset, setText };
};
