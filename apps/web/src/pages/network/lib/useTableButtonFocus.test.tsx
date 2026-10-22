import type { ReactElement } from 'react';

import {
  act,
  cleanup,
  render,
  screen,
} from '@testing-library/react';
import {
  afterEach,
  describe,
  expect,
  it,
} from 'vitest';

import { FocusHandoffProvider } from '@/shared/ui';

import { useOrganizationDirectoryTable } from '../model/useOrganizationDirectoryTable';
import { useTableButtonFocus } from './useTableButtonFocus';

const OPEN_LABEL = 'Open';
const CLOSE_LABEL = 'Close';

const Harness = (): ReactElement => {
  const table = useOrganizationDirectoryTable();
  const buttonRef = useTableButtonFocus(table.isOpen);

  return (
    <div>
      <button onClick={table.open} ref={buttonRef} type="button">{OPEN_LABEL}</button>
      {table.isOpen && <button onClick={table.close} type="button">{CLOSE_LABEL}</button>}
    </div>
  );
};

const renderHarness = (): ReturnType<typeof render> => render(
  <FocusHandoffProvider>
    <Harness />
  </FocusHandoffProvider>,
);

const click = (label: string): void => {
  act(() => {
    screen.getByRole('button', { name: label }).click();
  });
};

describe('useTableButtonFocus', () => {
  afterEach(() => {
    cleanup();
  });

  it('moves the focus back to the opening button when the table closes', () => {
    renderHarness();
    click(OPEN_LABEL);
    screen.getByRole('button', { name: CLOSE_LABEL }).focus();

    click(CLOSE_LABEL);

    expect(document.activeElement).toBe(screen.getByRole('button', { name: OPEN_LABEL }));
  });

  it('does not take the focus while the table stays closed', () => {
    renderHarness();

    expect(document.activeElement).toBe(document.body);
  });
});
