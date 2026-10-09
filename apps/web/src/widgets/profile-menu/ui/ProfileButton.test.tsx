import type { ReactElement } from 'react';

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import {
  createRef,
  useState,
} from 'react';
import { defaultLocaleCatalog } from 'virtual:build-profile';
import {
  afterEach,
  describe,
  expect,
  it,
} from 'vitest';

import { createTestRuntime } from '@/shared/api/index.testing';
import { createMemoryLocation } from '@/shared/routing/index.testing';
import { createThemePreferenceStore } from '@/shared/theme';
import { useFocusHandoff } from '@/shared/ui';

import type { ProfileSessionOptionsValue } from '../lib/testing/profileMenuHarness';

import { PROFILE_MENU_FOCUS_KEY } from '../lib/profileMenuFocusKey';
import {
  createGate,
  createProfileLocalizer,
  createProfileRoutes,
  PROFILE_ACTING_CONTEXT,
  PROFILE_BUYER_PERSONA,
  ProfileTreeProviders,
} from '../lib/testing/profileMenuHarness';
import { ProfileButton } from './ProfileButton';

const LOADING_NAME = defaultLocaleCatalog['profile.button.loading'];
const READY_NAME = defaultLocaleCatalog['profile.button.label']
  .replace('{name}', PROFILE_BUYER_PERSONA.userDisplayName)
  .replace('{organization}', PROFILE_BUYER_PERSONA.organizationName);

const renderButton = async (ui: ReactElement, sessionOptions: ProfileSessionOptionsValue = {}): Promise<void> => {
  const localizer = await createProfileLocalizer();
  const runtime = createTestRuntime({ routes: createProfileRoutes(sessionOptions) });
  runtime.actingContext.set(PROFILE_ACTING_CONTEXT);

  render(
    <ProfileTreeProviders
      localizer={localizer}
      location={createMemoryLocation('/network')}
      runtime={runtime}
      themeStore={createThemePreferenceStore({ colorSchemeQuery: undefined, storage: undefined, storageEvents: undefined })}
    >
      {ui}
    </ProfileTreeProviders>,
  );
};

const FocusClaimProbe = (): ReactElement => {
  const { requestFocus } = useFocusHandoff<HTMLButtonElement>(PROFILE_MENU_FOCUS_KEY);
  const [generation, setGeneration] = useState(0);

  const handleRemountClick = (): void => {
    requestFocus();
    setGeneration(current => current + 1);
  };

  return (
    <>
      <button data-testid="remount-probe" onClick={handleRemountClick} type="button" />
      <ProfileButton key={generation} />
    </>
  );
};

describe('ProfileButton', () => {
  afterEach(() => {
    cleanup();
  });

  it('is a focusable round button with a skeleton and the neutral name while the session loads', async () => {
    const gate = createGate();
    await renderButton(<ProfileButton />, { sessionGate: gate });

    const button = screen.getByRole('button', { name: LOADING_NAME });
    button.focus();

    expect(document.activeElement).toBe(button);
    expect(button.getAttribute('aria-haspopup')).toBe('menu');
    expect(button.textContent).toBe('');
    expect(button.querySelector('.rounded-full.size-9')).not.toBeNull();
    expect(button.className).toContain('rounded-full');

    gate.open();
    await screen.findByRole('button', { name: READY_NAME });
  });

  it('names itself by the user and the organization and shows the initials once the session is ready', async () => {
    await renderButton(<ProfileButton />);

    const button = await screen.findByRole('button', { name: READY_NAME });

    expect(button.textContent).toBe('АС');
    expect(button.querySelector('.rounded-full.size-9')?.getAttribute('aria-hidden')).toBe('true');
    expect(button.querySelector('[aria-busy]')).toBeNull();
  });

  it('shows the user icon and the neutral name when the session request fails', async () => {
    await renderButton(<ProfileButton />, { sessionMode: 'error' });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: LOADING_NAME }).querySelector('svg')).not.toBeNull();
    });
    const button = screen.getByRole('button', { name: LOADING_NAME });

    expect(button.textContent).toBe('');
    expect(button.querySelector('.size-9')).toBeNull();
    expect(button.querySelector('svg.lucide-user')).not.toBeNull();
  });

  it('is busy and ignores presses while the pending flag is set', async () => {
    let pressCount = 0;
    const handleClick = (): void => {
      pressCount += 1;
    };
    await renderButton(<ProfileButton onClick={handleClick} pending />);

    const button = screen.getByRole('button', { name: LOADING_NAME });
    fireEvent.click(button);

    expect(button.getAttribute('aria-busy')).toBe('true');
    expect(pressCount).toBe(0);
  });

  it('fills the ref of the owner', async () => {
    const buttonRef = createRef<HTMLButtonElement>();
    await renderButton(<ProfileButton buttonRef={buttonRef} />);

    expect(buttonRef.current).toBe(screen.getByRole('button', { name: LOADING_NAME }));
  });

  it('takes the requested focus when it appears again', async () => {
    await renderButton(<FocusClaimProbe />);
    await screen.findByRole('button', { name: READY_NAME });

    fireEvent.click(screen.getByTestId('remount-probe'));

    await waitFor(() => {
      expect(document.activeElement).toBe(screen.getByRole('button', { name: READY_NAME }));
    });
  });
});
