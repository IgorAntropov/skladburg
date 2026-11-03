import {
  useEffect,
  useState,
} from 'react';

export const useDebouncedValue = <TValue>(value: TValue, delayMs: number): TValue => {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delayMs);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delayMs]);

  return debouncedValue;
};
