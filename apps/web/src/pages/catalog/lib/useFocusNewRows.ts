import type { RefObject } from 'react';

import {
  useEffect,
  useRef,
} from 'react';

export interface FocusNewRowsValue {
  expectNewRows: () => void;
  listRef: RefObject<HTMLUListElement | null>;
}

export const useFocusNewRows = (rowCount: number | undefined): FocusNewRowsValue => {
  const listRef = useRef<HTMLUListElement>(null);
  const firstNewRowIndexRef = useRef<number | undefined>(undefined);

  const expectNewRows = (): void => {
    firstNewRowIndexRef.current = rowCount;
  };

  useEffect(() => {
    const index = firstNewRowIndexRef.current;

    if (index === undefined || rowCount === undefined || rowCount <= index) {
      return;
    }

    firstNewRowIndexRef.current = undefined;
    listRef.current?.querySelectorAll('a')[index]?.focus();
  }, [rowCount]);

  return { expectNewRows, listRef };
};
