import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import {
  afterEach,
  describe,
  expect,
  it,
} from 'vitest';

import type { TabsItemValue } from './Tabs';

import { Tabs } from './Tabs';

const LIST_LABEL = 'Lists';
const DEALS_CONTENT = 'Deals content';
const TRIPS_CONTENT = 'Trips content';
const WAREHOUSES_CONTENT = 'Warehouses content';

const ITEMS: readonly TabsItemValue[] = [
  { content: <p>{DEALS_CONTENT}</p>, count: 3, id: 'deals', label: 'Deals' },
  { content: <p>{TRIPS_CONTENT}</p>, id: 'trips', label: 'Trips' },
  { content: <p>{WAREHOUSES_CONTENT}</p>, count: 0, id: 'warehouses', label: 'Warehouses' },
];

describe('Tabs', () => {
  afterEach(() => {
    cleanup();
  });

  it('is a tab list named by its label with a tab for every item', () => {
    render(<Tabs items={ITEMS} label={LIST_LABEL} />);

    expect(screen.getByRole('tablist', { name: LIST_LABEL })).toBeTruthy();
    expect(screen.getAllByRole('tab')).toHaveLength(ITEMS.length);
  });

  it('selects the first tab and shows only its panel by default', () => {
    render(<Tabs items={ITEMS} label={LIST_LABEL} />);

    expect(screen.getByRole('tab', { name: 'Deals 3' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('tab', { name: 'Trips' }).getAttribute('aria-selected')).toBe('false');
    expect(screen.getByRole('tabpanel').textContent).toBe(DEALS_CONTENT);
  });

  it('selects the tab asked for as the default one', () => {
    render(<Tabs defaultTabId="warehouses" items={ITEMS} label={LIST_LABEL} />);

    expect(screen.getByRole('tab', { name: 'Warehouses 0' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('tabpanel').textContent).toBe(WAREHOUSES_CONTENT);
  });

  it('switches the panel when another tab is pressed', () => {
    render(<Tabs items={ITEMS} label={LIST_LABEL} />);

    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Trips' }));

    expect(screen.getByRole('tab', { name: 'Trips' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('tabpanel').textContent).toBe(TRIPS_CONTENT);
    expect(screen.queryByText(DEALS_CONTENT)).toBeNull();
  });

  it('names the panel by its tab', () => {
    render(<Tabs items={ITEMS} label={LIST_LABEL} />);

    expect(screen.getByRole('tabpanel', { name: 'Deals 3' })).toBeTruthy();
  });

  it('adds the counter after the label to the name of the tab and leaves the tab without one alone', () => {
    render(<Tabs items={ITEMS} label={LIST_LABEL} />);

    expect(screen.getByRole('tab', { name: 'Deals 3' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Warehouses 0' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Trips' })).toBeTruthy();
  });

  it('keeps the touch target of a tab at 44 px', () => {
    render(<Tabs items={ITEMS} label={LIST_LABEL} />);

    expect(screen.getByRole('tab', { name: 'Trips' }).className).toContain('min-h-11');
  });

  it('moves the selection with the arrow keys', async () => {
    render(<Tabs items={ITEMS} label={LIST_LABEL} />);
    const firstTab = screen.getByRole('tab', { name: 'Deals 3' });
    firstTab.focus();

    fireEvent.keyDown(firstTab, { key: 'ArrowRight' });

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: 'Trips' }).getAttribute('aria-selected')).toBe('true');
    });
  });
});
