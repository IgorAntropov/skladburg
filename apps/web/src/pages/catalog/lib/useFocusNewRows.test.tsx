import type { ReactElement } from 'react';

import {
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import { useState } from 'react';
import {
  afterEach,
  describe,
  expect,
  it,
} from 'vitest';

import { useFocusNewRows } from './useFocusNewRows';

interface RowsProps {
  isDelayed?: boolean;
}

const Rows = ({ isDelayed = false }: RowsProps): ReactElement => {
  const [count, setCount] = useState(2);
  const { expectNewRows, listRef } = useFocusNewRows(count);

  const handleMoreClick = (): void => {
    expectNewRows();
    setCount(current => current + (isDelayed ? 0 : 2));
  };

  const handleSilentClick = (): void => {
    setCount(current => current + 2);
  };

  const handleArriveClick = (): void => {
    setCount(current => current + 2);
  };

  return (
    <>
      <button data-testid="more" onClick={handleMoreClick} type="button" />
      <button data-testid="silent" onClick={handleSilentClick} type="button" />
      <button data-testid="arrive" onClick={handleArriveClick} type="button" />
      <ul ref={listRef}>
        {Array.from({ length: count }, (_, index) => (
          <li key={index}>
            <a data-testid={`row-${String(index)}`} href={`#row-${String(index)}`} />
          </li>
        ))}
      </ul>
    </>
  );
};

describe('useFocusNewRows', () => {
  afterEach(() => {
    cleanup();
  });

  it('moves the focus to the first row that arrived after more rows were requested', () => {
    render(<Rows />);

    fireEvent.click(screen.getByTestId('more'));

    expect(document.activeElement).toBe(screen.getByTestId('row-2'));
  });

  it('leaves the focus alone when nobody asked for more rows', () => {
    render(<Rows />);

    fireEvent.click(screen.getByTestId('silent'));

    expect(document.activeElement).not.toBe(screen.getByTestId('row-2'));
  });

  it('waits until the new rows really arrive', () => {
    render(<Rows isDelayed />);

    fireEvent.click(screen.getByTestId('more'));

    expect(document.activeElement).not.toBe(screen.getByTestId('row-1'));

    fireEvent.click(screen.getByTestId('arrive'));

    expect(document.activeElement).toBe(screen.getByTestId('row-2'));
  });
});
