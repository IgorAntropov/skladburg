import type { ReactElement } from 'react';

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
  vi,
} from 'vitest';

import { Button } from '../button/Button';
import { DropdownMenu } from './DropdownMenu';
import { DropdownMenuContent } from './DropdownMenuContent';
import { DropdownMenuItem } from './DropdownMenuItem';
import { DropdownMenuLabel } from './DropdownMenuLabel';
import { DropdownMenuRadioGroup } from './DropdownMenuRadioGroup';
import { DropdownMenuRadioItem } from './DropdownMenuRadioItem';
import { DropdownMenuSeparator } from './DropdownMenuSeparator';
import { DropdownMenuTrigger } from './DropdownMenuTrigger';

type RoleValue = 'buyer' | 'carrier' | 'seller';

const TRIGGER_LABEL = 'Sign in as: Buyer';
const TRIGGER_TEXT = 'Sign in as';
const MENU_LABEL = 'Personas';
const GROUP_LABEL = 'Persona';
const BUYER_TEXT = 'Buyer';
const CARRIER_TEXT = 'Carrier';
const SELLER_TEXT = 'Seller';
const ACTION_TEXT = 'Reset';
const HEADING_TEXT = 'Roles';

interface RoleMenuProps {
  onReset?: (() => void) | undefined;
  onValueChange: (value: RoleValue) => void;
  value: RoleValue | undefined;
}

const RoleMenu = ({ onReset = vi.fn(), onValueChange, value }: RoleMenuProps): ReactElement => (
  <DropdownMenu>
    <DropdownMenuTrigger>
      <Button aria-label={TRIGGER_LABEL}>{TRIGGER_TEXT}</Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent label={MENU_LABEL}>
      <DropdownMenuLabel>{HEADING_TEXT}</DropdownMenuLabel>
      <DropdownMenuRadioGroup label={GROUP_LABEL} onValueChange={onValueChange} value={value}>
        <DropdownMenuRadioItem value="buyer">{BUYER_TEXT}</DropdownMenuRadioItem>
        <DropdownMenuRadioItem value="carrier">{CARRIER_TEXT}</DropdownMenuRadioItem>
        <DropdownMenuRadioItem disabled value="seller">{SELLER_TEXT}</DropdownMenuRadioItem>
      </DropdownMenuRadioGroup>
      <DropdownMenuSeparator />
      <DropdownMenuItem onSelect={onReset}>{ACTION_TEXT}</DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
);

const openWithArrowDown = async (): Promise<HTMLElement> => {
  const trigger = screen.getByRole('button', { name: TRIGGER_LABEL });
  trigger.focus();
  fireEvent.keyDown(trigger, { key: 'ArrowDown' });
  await screen.findByRole('menu');

  return trigger;
};

describe('DropdownMenu', () => {
  afterEach(() => {
    cleanup();
  });

  it('gives the trigger an accessible name and a closed popup', () => {
    render(<RoleMenu onValueChange={vi.fn()} value="buyer" />);
    const trigger = screen.getByRole('button', { name: TRIGGER_LABEL });

    expect(trigger.getAttribute('aria-haspopup')).toBe('menu');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('opens on the arrow down key of the closed trigger and does not change the value', async () => {
    const onValueChange = vi.fn();
    render(<RoleMenu onValueChange={onValueChange} value="buyer" />);

    const trigger = await openWithArrowDown();

    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it('names the menu and the group', async () => {
    render(<RoleMenu onValueChange={vi.fn()} value="buyer" />);

    await openWithArrowDown();

    expect(screen.getByRole('menu', { name: MENU_LABEL })).toBeTruthy();
    expect(screen.getByRole('group', { name: GROUP_LABEL })).toBeTruthy();
  });

  it('marks only the chosen item as checked', async () => {
    render(<RoleMenu onValueChange={vi.fn()} value="buyer" />);

    await openWithArrowDown();

    expect(screen.getByRole('menuitemradio', { name: BUYER_TEXT }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByRole('menuitemradio', { name: CARRIER_TEXT }).getAttribute('aria-checked')).toBe('false');
  });

  it('moves the highlight with the arrow keys without changing the value', async () => {
    const onValueChange = vi.fn();
    render(<RoleMenu onValueChange={onValueChange} value="buyer" />);

    await openWithArrowDown();
    const menu = screen.getByRole('menu');
    fireEvent.keyDown(menu, { key: 'ArrowDown' });
    fireEvent.keyDown(menu, { key: 'ArrowDown' });
    fireEvent.keyDown(menu, { key: 'ArrowUp' });

    expect(onValueChange).not.toHaveBeenCalled();
    expect(screen.getByRole('menu')).toBeTruthy();
  });

  it('selects the focused item once with Enter, closes the menu and returns the focus to the trigger', async () => {
    const onValueChange = vi.fn();
    render(<RoleMenu onValueChange={onValueChange} value="buyer" />);

    const trigger = await openWithArrowDown();
    const carrier = screen.getByRole('menuitemradio', { name: CARRIER_TEXT });
    carrier.focus();
    fireEvent.keyDown(carrier, { key: 'Enter' });

    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange).toHaveBeenCalledWith('carrier');
    await waitFor(() => {
      expect(screen.queryByRole('menu')).toBeNull();
    });
    await waitFor(() => {
      expect(document.activeElement).toBe(trigger);
    });
  });

  it('selects an item with Space as well', async () => {
    const onValueChange = vi.fn();
    render(<RoleMenu onValueChange={onValueChange} value="buyer" />);

    await openWithArrowDown();
    const carrier = screen.getByRole('menuitemradio', { name: CARRIER_TEXT });
    carrier.focus();
    fireEvent.keyDown(carrier, { key: ' ' });

    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange).toHaveBeenCalledWith('carrier');
  });

  it('closes on Escape without changing the value', async () => {
    const onValueChange = vi.fn();
    render(<RoleMenu onValueChange={onValueChange} value="buyer" />);

    const trigger = await openWithArrowDown();
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' });

    await waitFor(() => {
      expect(screen.queryByRole('menu')).toBeNull();
    });
    expect(onValueChange).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(document.activeElement).toBe(trigger);
    });
  });

  it('does not select a disabled item', async () => {
    const onValueChange = vi.fn();
    render(<RoleMenu onValueChange={onValueChange} value="buyer" />);

    await openWithArrowDown();
    const seller = screen.getByRole('menuitemradio', { name: SELLER_TEXT });
    fireEvent.keyDown(seller, { key: 'Enter' });
    fireEvent.click(seller);

    expect(seller.hasAttribute('data-disabled')).toBe(true);
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it('calls onSelect of a plain item once and closes the menu', async () => {
    const onReset = vi.fn();
    render(<RoleMenu onReset={onReset} onValueChange={vi.fn()} value="buyer" />);

    await openWithArrowDown();
    const reset = screen.getByRole('menuitem', { name: ACTION_TEXT });
    reset.focus();
    fireEvent.keyDown(reset, { key: 'Enter' });

    expect(onReset).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(screen.queryByRole('menu')).toBeNull();
    });
  });

  it('selects an item once on a click and closes the menu', async () => {
    const onValueChange = vi.fn();
    render(<RoleMenu onValueChange={onValueChange} value="buyer" />);

    await openWithArrowDown();
    fireEvent.click(screen.getByRole('menuitemradio', { name: CARRIER_TEXT }));

    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange).toHaveBeenCalledWith('carrier');
    await waitFor(() => {
      expect(screen.queryByRole('menu')).toBeNull();
    });
  });

  it('reports the open state of a controlled menu and stays closed until the owner opens it', async () => {
    const onOpenChange = vi.fn();
    const { rerender } = render(
      <DropdownMenu onOpenChange={onOpenChange} open={false}>
        <DropdownMenuTrigger>
          <Button aria-label={TRIGGER_LABEL}>{TRIGGER_TEXT}</Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent label={MENU_LABEL}>
          <DropdownMenuItem onSelect={vi.fn()}>{ACTION_TEXT}</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    );
    const trigger = screen.getByRole('button', { name: TRIGGER_LABEL });
    trigger.focus();
    fireEvent.keyDown(trigger, { key: 'ArrowDown' });

    expect(onOpenChange).toHaveBeenCalledWith(true);
    expect(screen.queryByRole('menu')).toBeNull();

    rerender(
      <DropdownMenu onOpenChange={onOpenChange} open>
        <DropdownMenuTrigger>
          <Button aria-label={TRIGGER_LABEL}>{TRIGGER_TEXT}</Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent label={MENU_LABEL}>
          <DropdownMenuItem onSelect={vi.fn()}>{ACTION_TEXT}</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    );

    expect(await screen.findByRole('menu', { name: MENU_LABEL })).toBeTruthy();
  });

  it('renders the label and the separator inside the menu', async () => {
    render(<RoleMenu onValueChange={vi.fn()} value={undefined} />);

    await openWithArrowDown();

    expect(screen.getByText(HEADING_TEXT)).toBeTruthy();
    expect(screen.getByRole('separator')).toBeTruthy();
  });

  it('keeps every item at least 44 pixels tall by class', async () => {
    render(<RoleMenu onValueChange={vi.fn()} value="buyer" />);

    await openWithArrowDown();

    expect(screen.getByRole('menuitemradio', { name: BUYER_TEXT }).className).toContain('min-h-11');
    expect(screen.getByRole('menuitem', { name: ACTION_TEXT }).className).toContain('min-h-11');
  });
});
