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

type RoleValue = 'carrier' | 'customer' | 'supplier';

const TRIGGER_LABEL = 'Sign in as: Customer';
const TRIGGER_TEXT = 'Sign in as';
const MENU_LABEL = 'Personas';
const GROUP_LABEL = 'Persona';
const CUSTOMER_TEXT = 'Customer';
const CARRIER_TEXT = 'Carrier';
const SUPPLIER_TEXT = 'Supplier';
const ACTION_TEXT = 'Reset';
const HEADING_TEXT = 'Roles';
const ORGANIZATION_TEXT = 'Organization';
const FULL_NAME = 'Customer, Administrator · Organization';
const OUTSIDE_LABEL = 'Outside action';
const OUTSIDE_REGION_LABEL = 'Outside region';

interface RoleMenuProps {
  onReset?: ((event: Event) => void) | undefined;
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
        <DropdownMenuRadioItem value="customer">{CUSTOMER_TEXT}</DropdownMenuRadioItem>
        <DropdownMenuRadioItem value="carrier">{CARRIER_TEXT}</DropdownMenuRadioItem>
        <DropdownMenuRadioItem disabled value="supplier">{SUPPLIER_TEXT}</DropdownMenuRadioItem>
      </DropdownMenuRadioGroup>
      <DropdownMenuSeparator />
      <DropdownMenuItem onSelect={onReset}>{ACTION_TEXT}</DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
);

const RoleMenuWithOutside = (): ReactElement => (
  <div>
    <nav aria-label={OUTSIDE_REGION_LABEL}>
      <Button aria-label={OUTSIDE_LABEL}>{OUTSIDE_LABEL}</Button>
    </nav>
    <RoleMenu onValueChange={vi.fn()} value="customer" />
  </div>
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
    render(<RoleMenu onValueChange={vi.fn()} value="customer" />);
    const trigger = screen.getByRole('button', { name: TRIGGER_LABEL });

    expect(trigger.getAttribute('aria-haspopup')).toBe('menu');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('opens on the arrow down key of the closed trigger and does not change the value', async () => {
    const onValueChange = vi.fn();
    render(<RoleMenu onValueChange={onValueChange} value="customer" />);

    const trigger = await openWithArrowDown();

    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it('names the menu and the group', async () => {
    render(<RoleMenu onValueChange={vi.fn()} value="customer" />);

    await openWithArrowDown();

    expect(screen.getByRole('menu', { name: MENU_LABEL })).toBeTruthy();
    expect(screen.getByRole('group', { name: GROUP_LABEL })).toBeTruthy();
  });

  it('marks only the chosen item as checked', async () => {
    render(<RoleMenu onValueChange={vi.fn()} value="customer" />);

    await openWithArrowDown();

    expect(screen.getByRole('menuitemradio', { name: CUSTOMER_TEXT }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByRole('menuitemradio', { name: CARRIER_TEXT }).getAttribute('aria-checked')).toBe('false');
  });

  it('moves the highlight with the arrow keys without changing the value', async () => {
    const onValueChange = vi.fn();
    render(<RoleMenu onValueChange={onValueChange} value="customer" />);

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
    render(<RoleMenu onValueChange={onValueChange} value="customer" />);

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
    render(<RoleMenu onValueChange={onValueChange} value="customer" />);

    await openWithArrowDown();
    const carrier = screen.getByRole('menuitemradio', { name: CARRIER_TEXT });
    carrier.focus();
    fireEvent.keyDown(carrier, { key: ' ' });

    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange).toHaveBeenCalledWith('carrier');
  });

  it('closes on Escape without changing the value', async () => {
    const onValueChange = vi.fn();
    render(<RoleMenu onValueChange={onValueChange} value="customer" />);

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

  it('does not hide the rest of the page from assistive technology while open', async () => {
    render(<RoleMenuWithOutside />);

    await openWithArrowDown();
    const outsideRegion = screen.getByLabelText(OUTSIDE_REGION_LABEL);
    const outsideButton = screen.getByRole('button', { name: OUTSIDE_LABEL });
    const trigger = screen.getByRole('button', { name: TRIGGER_LABEL });

    expect(outsideRegion.closest('[aria-hidden="true"]')).toBeNull();
    expect(outsideRegion.closest('[data-aria-hidden]')).toBeNull();
    expect(outsideButton.closest('[aria-hidden="true"]')).toBeNull();
    expect(trigger.closest('[aria-hidden="true"]')).toBeNull();
    expect(document.body.getAttribute('data-scroll-locked')).toBeNull();
    expect(document.body.style.pointerEvents).not.toBe('none');
  });

  it('closes on a pointer press outside the menu', async () => {
    const onValueChange = vi.fn();
    render(
      <div>
        <Button aria-label={OUTSIDE_LABEL}>{OUTSIDE_LABEL}</Button>
        <RoleMenu onValueChange={onValueChange} value="customer" />
      </div>,
    );

    await openWithArrowDown();
    fireEvent.pointerDown(screen.getByRole('button', { name: OUTSIDE_LABEL }));

    await waitFor(() => {
      expect(screen.queryByRole('menu')).toBeNull();
    });
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it('does not pull the focus back to the trigger after a press outside', async () => {
    render(<RoleMenuWithOutside />);

    const trigger = await openWithArrowDown();
    const outsideButton = screen.getByRole('button', { name: OUTSIDE_LABEL });
    fireEvent.pointerDown(outsideButton);
    outsideButton.focus();

    await waitFor(() => {
      expect(screen.queryByRole('menu')).toBeNull();
    });
    expect(document.activeElement).toBe(outsideButton);
    expect(document.activeElement).not.toBe(trigger);
  });

  it('closes when the focus moves to an element outside the menu', async () => {
    render(<RoleMenuWithOutside />);

    await openWithArrowDown();
    screen.getByRole('button', { name: OUTSIDE_LABEL }).focus();

    await waitFor(() => {
      expect(screen.queryByRole('menu')).toBeNull();
    });
  });

  it.each([
    ['Tab', false],
    ['Shift+Tab', true],
  ])('closes the menu on %s, returns the focus to the trigger and does not change the value', async (_name, isShift) => {
    const onValueChange = vi.fn();
    const onOpenChange = vi.fn();
    render(
      <DropdownMenu onOpenChange={onOpenChange}>
        <DropdownMenuTrigger>
          <Button aria-label={TRIGGER_LABEL}>{TRIGGER_TEXT}</Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent label={MENU_LABEL}>
          <DropdownMenuRadioGroup label={GROUP_LABEL} onValueChange={onValueChange} value="customer">
            <DropdownMenuRadioItem value="customer">{CUSTOMER_TEXT}</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="carrier">{CARRIER_TEXT}</DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>,
    );

    const trigger = await openWithArrowDown();
    const carrier = screen.getByRole('menuitemradio', { name: CARRIER_TEXT });
    carrier.focus();
    onOpenChange.mockClear();
    const isNotCancelled = fireEvent.keyDown(carrier, { key: 'Tab', shiftKey: isShift });

    expect(isNotCancelled).toBe(false);
    await waitFor(() => {
      expect(screen.queryByRole('menu')).toBeNull();
    });
    expect(onOpenChange).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onValueChange).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(document.activeElement).toBe(trigger);
    });
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
  });

  it('asks the owner of a controlled menu to close it on Tab and leaves it open until the owner agrees', async () => {
    const onOpenChange = vi.fn();
    render(
      <DropdownMenu onOpenChange={onOpenChange} open>
        <DropdownMenuTrigger>
          <Button aria-label={TRIGGER_LABEL}>{TRIGGER_TEXT}</Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent label={MENU_LABEL}>
          <DropdownMenuItem onSelect={vi.fn()}>{ACTION_TEXT}</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    );

    const item = await screen.findByRole('menuitem', { name: ACTION_TEXT });
    item.focus();
    fireEvent.keyDown(item, { key: 'Tab' });

    expect(onOpenChange).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(screen.getByRole('menu', { name: MENU_LABEL })).toBeTruthy();
  });

  it('lets the next Tab from the trigger follow the page order after the menu is closed by Tab', async () => {
    render(<RoleMenuWithOutside />);

    const trigger = await openWithArrowDown();
    const carrier = screen.getByRole('menuitemradio', { name: CARRIER_TEXT });
    carrier.focus();
    fireEvent.keyDown(carrier, { key: 'Tab' });
    await waitFor(() => {
      expect(document.activeElement).toBe(trigger);
    });

    const isNotCancelled = fireEvent.keyDown(trigger, { key: 'Tab' });

    expect(isNotCancelled).toBe(true);
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('does not select a disabled item', async () => {
    const onValueChange = vi.fn();
    render(<RoleMenu onValueChange={onValueChange} value="customer" />);

    await openWithArrowDown();
    const supplier = screen.getByRole('menuitemradio', { name: SUPPLIER_TEXT });
    fireEvent.keyDown(supplier, { key: 'Enter' });
    fireEvent.click(supplier);

    expect(supplier.hasAttribute('data-disabled')).toBe(true);
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it('calls onSelect of a plain item once and closes the menu', async () => {
    const onReset = vi.fn();
    render(<RoleMenu onReset={onReset} onValueChange={vi.fn()} value="customer" />);

    await openWithArrowDown();
    const reset = screen.getByRole('menuitem', { name: ACTION_TEXT });
    reset.focus();
    fireEvent.keyDown(reset, { key: 'Enter' });

    expect(onReset).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(screen.queryByRole('menu')).toBeNull();
    });
  });

  it('passes the select event of the menu to onSelect', async () => {
    const onReset = vi.fn<(event: Event) => void>();
    render(<RoleMenu onReset={onReset} onValueChange={vi.fn()} value="customer" />);

    await openWithArrowDown();
    const reset = screen.getByRole('menuitem', { name: ACTION_TEXT });
    reset.focus();
    fireEvent.keyDown(reset, { key: 'Enter' });

    const selectEvent = onReset.mock.calls[0]?.[0];

    expect(selectEvent).toBeInstanceOf(Event);
    expect(selectEvent?.target).toBe(reset);
    expect(selectEvent?.defaultPrevented).toBe(false);
  });

  it('keeps the menu open and the focus on the item when onSelect prevents the default', async () => {
    const onReset = vi.fn((event: Event): void => {
      event.preventDefault();
    });
    render(<RoleMenu onReset={onReset} onValueChange={vi.fn()} value="customer" />);

    await openWithArrowDown();
    const reset = screen.getByRole('menuitem', { name: ACTION_TEXT });
    reset.focus();
    fireEvent.keyDown(reset, { key: 'Enter' });

    expect(onReset).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('menu', { name: MENU_LABEL })).toBeTruthy();
    expect(document.activeElement).toBe(reset);
  });

  it('keeps the menu open on a click when onSelect prevents the default', async () => {
    const onReset = vi.fn((event: Event): void => {
      event.preventDefault();
    });
    render(<RoleMenu onReset={onReset} onValueChange={vi.fn()} value="customer" />);

    await openWithArrowDown();
    fireEvent.click(screen.getByRole('menuitem', { name: ACTION_TEXT }));

    expect(onReset).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('menu', { name: MENU_LABEL })).toBeTruthy();
  });

  it('selects an item once on a click and closes the menu', async () => {
    const onValueChange = vi.fn();
    render(<RoleMenu onValueChange={onValueChange} value="customer" />);

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
    render(<RoleMenu onValueChange={vi.fn()} value="customer" />);

    await openWithArrowDown();

    expect(screen.getByRole('menuitemradio', { name: CUSTOMER_TEXT }).className).toContain('min-h-11');
    expect(screen.getByRole('menuitem', { name: ACTION_TEXT }).className).toContain('min-h-11');
  });

  it('keeps the content width and the indicator at the start by default', async () => {
    render(<RoleMenu onValueChange={vi.fn()} value="customer" />);

    await openWithArrowDown();
    const customer = screen.getByRole('menuitemradio', { name: CUSTOMER_TEXT });

    expect(screen.getByRole('menu').className).not.toContain('w-[');
    expect(customer.getAttribute('aria-label')).toBeNull();
    expect(customer.firstElementChild?.className).not.toContain('ml-auto');
    expect(customer.lastChild?.textContent).toBe(CUSTOMER_TEXT);
  });

  it('limits the profile width to the viewport', async () => {
    render(
      <DropdownMenu open>
        <DropdownMenuTrigger>
          <Button aria-label={TRIGGER_LABEL}>{TRIGGER_TEXT}</Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent label={MENU_LABEL} width="profile">
          <DropdownMenuItem onSelect={vi.fn()}>{ACTION_TEXT}</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    );

    const menu = await screen.findByRole('menu', { name: MENU_LABEL });

    expect(menu.className).toContain('w-[min(22rem,calc(100vw-1rem))]');
    expect(menu.className).toContain('min-w-48');
  });

  it('names a radio item by its label instead of its content', async () => {
    render(
      <DropdownMenu open>
        <DropdownMenuTrigger>
          <Button aria-label={TRIGGER_LABEL}>{TRIGGER_TEXT}</Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent label={MENU_LABEL}>
          <DropdownMenuRadioGroup label={GROUP_LABEL} onValueChange={vi.fn()} value="customer">
            <DropdownMenuRadioItem label={FULL_NAME} value="customer">
              <span>{CUSTOMER_TEXT}</span>
              <span>{ORGANIZATION_TEXT}</span>
            </DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>,
    );

    const item = await screen.findByRole('menuitemradio', { name: FULL_NAME });

    expect(item.getAttribute('aria-label')).toBe(FULL_NAME);
    expect(item.getAttribute('aria-checked')).toBe('true');
  });

  it('puts the check before the content of the checked item by default and selects by click', async () => {
    const onValueChange = vi.fn();
    render(
      <DropdownMenu open>
        <DropdownMenuTrigger>
          <Button aria-label={TRIGGER_LABEL}>{TRIGGER_TEXT}</Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent label={MENU_LABEL}>
          <DropdownMenuRadioGroup label={GROUP_LABEL} onValueChange={onValueChange} value="customer">
            <DropdownMenuRadioItem value="customer">{CUSTOMER_TEXT}</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="carrier">{CARRIER_TEXT}</DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>,
    );

    const customer = await screen.findByRole('menuitemradio', { name: CUSTOMER_TEXT });

    expect(customer.firstElementChild?.querySelector('svg')).not.toBeNull();
    expect(customer.lastChild?.textContent).toBe(CUSTOMER_TEXT);
    expect(screen.getByRole('menuitemradio', { name: CARRIER_TEXT }).querySelector('svg')).toBeNull();

    fireEvent.click(screen.getByRole('menuitemradio', { name: CARRIER_TEXT }));

    expect(onValueChange).toHaveBeenCalledWith('carrier');
  });

  it('draws no check but keeps the checked state when the indicator is turned off', async () => {
    render(
      <DropdownMenu open>
        <DropdownMenuTrigger>
          <Button aria-label={TRIGGER_LABEL}>{TRIGGER_TEXT}</Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent label={MENU_LABEL}>
          <DropdownMenuRadioGroup label={GROUP_LABEL} onValueChange={vi.fn()} value="customer">
            <DropdownMenuRadioItem indicatorPlacement="none" value="customer">{CUSTOMER_TEXT}</DropdownMenuRadioItem>
            <DropdownMenuRadioItem indicatorPlacement="none" value="carrier">{CARRIER_TEXT}</DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>,
    );

    const customer = await screen.findByRole('menuitemradio', { name: CUSTOMER_TEXT });

    expect(customer.getAttribute('aria-checked')).toBe('true');
    expect(customer.querySelector('svg')).toBeNull();
    expect(customer.childElementCount).toBe(0);
    expect(customer.textContent).toBe(CUSTOMER_TEXT);
  });
});
