import type { ReactElement } from 'react';

import {
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import type { AppAddressValue } from '../address/addressTypes';

import { createMemoryLocation } from '../location/testing/createMemoryLocation';
import { AddressLink } from './AddressLink';
import { RoutingProvider } from './RoutingProvider';

const LINK_LABEL = 'Deal link';
const DEAL_ID = '00000000-0000-4000-8000-000000000001';
const dealAddress: AppAddressValue = { kind: 'object', object: { id: DEAL_ID, type: 'deal' } };

const renderLink = (extraProps: Partial<Parameters<typeof AddressLink>[0]> = {}): ReturnType<typeof createMemoryLocation> => {
  const location = createMemoryLocation('/network');
  const element: ReactElement = (
    <RoutingProvider location={location}>
      <AddressLink to={dealAddress} {...extraProps}>
        {LINK_LABEL}
      </AddressLink>
    </RoutingProvider>
  );

  render(element);

  return location;
};

describe('AddressLink', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders a real anchor with the fragment href', () => {
    renderLink();

    expect(screen.getByRole('link', { name: LINK_LABEL }).getAttribute('href')).toBe(`#/deals/${DEAL_ID}`);
  });

  it('passes other anchor props through', () => {
    renderLink({ 'aria-current': 'page', 'className': 'nav-link', 'id': 'deal-link' });

    const link = screen.getByRole('link', { name: LINK_LABEL });

    expect(link.getAttribute('aria-current')).toBe('page');
    expect(link.className).toBe('nav-link');
    expect(link.id).toBe('deal-link');
  });

  it('navigates on a plain left click and cancels the native navigation', () => {
    const location = renderLink();

    const isNotPrevented = fireEvent.click(screen.getByRole('link', { name: LINK_LABEL }));

    expect(isNotPrevented).toBe(false);
    expect(location.history).toEqual(['/network', `/deals/${DEAL_ID}`]);
  });

  it('calls the user click handler before navigating', () => {
    const onClick = vi.fn();
    const location = renderLink({ onClick });

    fireEvent.click(screen.getByRole('link', { name: LINK_LABEL }));

    expect(onClick).toHaveBeenCalledTimes(1);
    expect(location.currentIndex).toBe(1);
  });

  it.each([
    ['ctrl', { ctrlKey: true }],
    ['meta', { metaKey: true }],
    ['shift', { shiftKey: true }],
    ['alt', { altKey: true }],
    ['middle button', { button: 1 }],
    ['right button', { button: 2 }],
  ])('does not intercept a click with %s', (_, eventInit) => {
    const location = renderLink();

    const isNotPrevented = fireEvent.click(screen.getByRole('link', { name: LINK_LABEL }), eventInit);

    expect(isNotPrevented).toBe(true);
    expect(location.history).toEqual(['/network']);
  });

  it('does not intercept a link that opens in a new tab', () => {
    const location = renderLink({ target: '_blank' });

    const isNotPrevented = fireEvent.click(screen.getByRole('link', { name: LINK_LABEL }));

    expect(isNotPrevented).toBe(true);
    expect(location.history).toEqual(['/network']);
    expect(screen.getByRole('link', { name: LINK_LABEL }).getAttribute('target')).toBe('_blank');
  });

  it('intercepts a link with the self target', () => {
    const location = renderLink({ target: '_self' });

    fireEvent.click(screen.getByRole('link', { name: LINK_LABEL }));

    expect(location.currentIndex).toBe(1);
  });

  it('does not intercept a download link', () => {
    const location = renderLink({ download: 'deal.pdf' });

    const isNotPrevented = fireEvent.click(screen.getByRole('link', { name: LINK_LABEL }));

    expect(isNotPrevented).toBe(true);
    expect(location.history).toEqual(['/network']);
  });

  it('does not intercept a click already prevented by the user handler', () => {
    const location = renderLink({
      onClick: (event) => {
        event.preventDefault();
      },
    });

    fireEvent.click(screen.getByRole('link', { name: LINK_LABEL }));

    expect(location.history).toEqual(['/network']);
  });

  it('throws outside of the provider', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    expect(() => render(<AddressLink to={{ kind: 'home' }}>{LINK_LABEL}</AddressLink>)).toThrow(
      'Routing hooks must be used inside RoutingProvider',
    );

    consoleError.mockRestore();
  });
});
