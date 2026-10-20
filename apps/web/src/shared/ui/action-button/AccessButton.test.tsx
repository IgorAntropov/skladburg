import {
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import { defaultLocaleCatalog } from 'virtual:build-profile';
import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import type { CommandAccessValue } from '@/shared/api';

import { withTestLocalizer } from '@/shared/i18n/index.testing';

import { AccessButton } from './AccessButton';

const BUTTON_LABEL = 'Добавить склад';
const PERMISSION_NAME = defaultLocaleCatalog['permission.warehouse_create'];

const renderButton = (access: CommandAccessValue): ReturnType<typeof vi.fn> => {
  const onClick = vi.fn();

  render(withTestLocalizer(<AccessButton access={access} onClick={onClick}>{BUTTON_LABEL}</AccessButton>));

  return onClick;
};

const readDescription = (button: HTMLElement): string | undefined => {
  const describedById = button.getAttribute('aria-describedby');

  return describedById === null ? undefined : document.getElementById(describedById)?.textContent ?? undefined;
};

describe('AccessButton', () => {
  afterEach(() => {
    cleanup();
  });

  it('passes the press through when the access is allowed', () => {
    const onClick = renderButton({ status: 'allowed' });

    const button = screen.getByRole('button', { name: BUTTON_LABEL });
    fireEvent.click(button);

    expect(onClick).toHaveBeenCalledTimes(1);
    expect(button.getAttribute('aria-disabled')).toBeNull();
    expect(button.getAttribute('aria-describedby')).toBeNull();
  });

  it('blocks the press and names the missing permission when the access is denied', () => {
    const onClick = renderButton({ permission: 'warehouse_create', status: 'denied' });

    const button = screen.getByRole('button', { name: BUTTON_LABEL });
    fireEvent.click(button);

    expect(onClick).not.toHaveBeenCalled();
    expect(button.getAttribute('aria-disabled')).toBe('true');
    expect(readDescription(button)).toContain(PERMISSION_NAME);
  });

  it('blocks the press without a reason while the access is being checked', () => {
    const onClick = renderButton({ status: 'checking' });

    const button = screen.getByRole('button', { name: BUTTON_LABEL });
    fireEvent.click(button);

    expect(onClick).not.toHaveBeenCalled();
    expect(button.getAttribute('aria-disabled')).toBe('true');
    expect(button.getAttribute('aria-describedby')).toBeNull();
  });
});
