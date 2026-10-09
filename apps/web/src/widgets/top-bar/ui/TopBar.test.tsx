import type { ReactElement } from 'react';

import {
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { defaultLocaleCatalog } from 'virtual:build-profile';
import {
  afterEach,
  describe,
  expect,
  it,
} from 'vitest';

import type { ViewportClassValue } from '@/shared/lib/viewport';
import type { IFakeViewport } from '@/shared/lib/viewport/index.testing';
import type { AppSectionValue } from '@/shared/routing';
import type { IMemoryLocation } from '@/shared/routing/index.testing';

import { createTestRuntime } from '@/shared/api/index.testing';
import { installFakeViewport } from '@/shared/lib/viewport/index.testing';
import {
  APP_SECTIONS,
  SECTION_TITLE_KEYS,
} from '@/shared/routing';

import { createWorldClockRoutes } from '../lib/testing/worldClockHarness';

const BRAND_NAME = 'Северный склад';
const PRODUCT_NAME = defaultLocaleCatalog['app.productName'];
const PROFILE_NODE_TEST_ID = 'profile-node';
const PROFILE_NODE_TEXT = 'profile';
const VIEWPORT_CLASSES: readonly ViewportClassValue[] = ['phone', 'tablet', 'desktop'];

interface RenderedTopBarValue {
  location: IMemoryLocation;
  viewport: IFakeViewport;
}

interface RenderTopBarOptionsValue {
  currentSection?: 'none' | AppSectionValue;
  hasProfileMenu?: boolean;
  sections?: readonly AppSectionValue[];
  viewportClass?: ViewportClassValue;
}

let installedViewport: IFakeViewport | undefined;

const renderTopBar = async ({
  currentSection = 'network',
  hasProfileMenu = true,
  sections = APP_SECTIONS,
  viewportClass = 'desktop',
}: RenderTopBarOptionsValue = {}): Promise<RenderedTopBarValue> => {
  installedViewport?.restore();
  const viewport = installFakeViewport(viewportClass);
  installedViewport = viewport;

  const [
    { ApiRuntimeProvider },
    { createLocalizer, LocalizerProvider },
    { RoutingProvider },
    { createMemoryLocation },
    { TenantSettingsProvider },
    { TopBar },
  ] = await Promise.all([
    import('@/shared/api'),
    import('@/shared/i18n'),
    import('@/shared/routing'),
    import('@/shared/routing/index.testing'),
    import('@/shared/tenant'),
    import('./TopBar'),
  ]);

  const localizer = await createLocalizer({
    bundledLocales: ['ru'],
    catalogLoaders: { ru: () => Promise.resolve(defaultLocaleCatalog) },
    requestedLocale: undefined,
    tenant: { availableLocales: ['ru'], defaultLocale: 'ru', termOverrides: {} },
    userTimeZone: 'UTC',
  });
  const shownSection = currentSection === 'none' ? undefined : currentSection;
  const location = createMemoryLocation(currentSection === 'none' ? '/' : `/${currentSection}`);
  const tenantSettings = {
    availableLocales: ['ru'],
    brandName: BRAND_NAME,
    defaultLocale: 'ru',
    tenantId: 'f2000001-0000-4000-8000-000000000000',
    termOverrides: {},
  };
  const profileMenu: ReactElement | undefined = hasProfileMenu
    ? <div data-testid={PROFILE_NODE_TEST_ID}>{PROFILE_NODE_TEXT}</div>
    : undefined;

  const runtime = createTestRuntime({ routes: createWorldClockRoutes().routes });
  const queryClient = new QueryClient({ defaultOptions: { queries: { networkMode: 'always', retry: false } } });

  render(
    <RoutingProvider location={location}>
      <LocalizerProvider localizer={localizer}>
        <ApiRuntimeProvider runtime={runtime}>
          <QueryClientProvider client={queryClient}>
            <TenantSettingsProvider tenantSettings={tenantSettings}>
              <TopBar currentSection={shownSection} profileMenu={profileMenu} sections={sections} />
            </TenantSettingsProvider>
          </QueryClientProvider>
        </ApiRuntimeProvider>
      </LocalizerProvider>
    </RoutingProvider>,
  );

  await waitFor(() => {
    expect(screen.getByTestId('top-bar-clock-slot').querySelector('time')).not.toBeNull();
  });

  return { location, viewport };
};

const getSectionTitle = (section: AppSectionValue): string => defaultLocaleCatalog[SECTION_TITLE_KEYS[section]];

const getNavigation = (): HTMLElement => screen.getByRole('navigation', { name: defaultLocaleCatalog['app.nav.label'] });

describe('TopBar', () => {
  afterEach(() => {
    cleanup();
    installedViewport?.restore();
    installedViewport = undefined;
  });

  describe('product mark', () => {
    it('is the banner of the page with the product name without translation', async () => {
      await renderTopBar();

      const banner = screen.getByRole('banner');
      const name = within(banner).getByText(PRODUCT_NAME);

      expect(name.getAttribute('translate')).toBe('no');
    });

    it('draws a decorative mark before the product name', async () => {
      await renderTopBar();

      const mark = within(screen.getByRole('banner')).getByTestId('product-mark');
      const name = within(screen.getByRole('banner')).getByText(PRODUCT_NAME);

      expect(mark.getAttribute('aria-hidden')).toBe('true');
      expect(mark.getAttribute('focusable')).toBe('false');
      expect(mark.tagName.toLowerCase()).toBe('svg');
      expect(mark.compareDocumentPosition(name) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it('takes the colour of the mark from the text colour of a token', async () => {
      await renderTopBar();

      const mark = screen.getByTestId('product-mark');

      expect(mark.getAttribute('stroke')).toBe('currentColor');
      expect(mark.getAttribute('class')).toContain('text-indicator');
    });

    it.each(VIEWPORT_CLASSES)('does not show the brand of the organization on a %s', async (viewportClass) => {
      await renderTopBar({ viewportClass });

      expect(screen.queryByText(BRAND_NAME)).toBeNull();
    });
  });

  describe('structure', () => {
    it('has a labelled navigation with a link to every given section in order', async () => {
      const sections: AppSectionValue[] = ['network', 'deals', 'warehouse'];
      await renderTopBar({ sections });

      const links = within(getNavigation()).getAllByRole('link');

      expect(links.map(link => link.textContent)).toEqual(sections.map(getSectionTitle));
      expect(links.map(link => link.getAttribute('href'))).toEqual(['#/network', '#/deals', '#/warehouse']);
    });

    it.each(APP_SECTIONS)('marks only the section %s as the current page', async (section) => {
      await renderTopBar({ currentSection: section });

      const current = within(getNavigation()).getAllByRole('link').filter(link => link.getAttribute('aria-current') === 'page');

      expect(current.map(link => link.textContent)).toEqual([getSectionTitle(section)]);
    });

    it('marks no section when there is no current one', async () => {
      await renderTopBar({ currentSection: 'none' });

      const current = within(getNavigation()).getAllByRole('link').filter(link => link.hasAttribute('aria-current'));

      expect(current).toEqual([]);
    });

    it('shows the product name and an empty navigation without sections', async () => {
      await renderTopBar({ sections: [] });

      expect(screen.getByText(PRODUCT_NAME)).toBeDefined();
      expect(within(getNavigation()).queryAllByRole('link')).toEqual([]);
    });

    it('opens the section by the link and leaves the modified click to the browser', async () => {
      const { location } = await renderTopBar();
      const link = within(getNavigation()).getByRole('link', { name: getSectionTitle('deals') });

      fireEvent.click(link, { ctrlKey: true });
      fireEvent.click(link);

      expect(location.history).toEqual(['/network', '/deals']);
    });

    it('hides the navigation row from phones, where the sections live in the profile menu', async () => {
      await renderTopBar();

      expect(getNavigation().className).toContain('hidden');
      expect(getNavigation().className).toContain('sm:flex');
    });

    it.each(VIEWPORT_CLASSES)('shows the clock of the world with a time on a %s', async (viewportClass) => {
      await renderTopBar({ viewportClass });

      const clock = screen.getByRole('group', { name: defaultLocaleCatalog['clock.label'] });

      expect(clock).toBe(screen.getByTestId('top-bar-clock-slot'));
      expect(clock.querySelector('time')?.textContent).toMatch(/^\d{2}:\d{2}$/);
      expect(clock.className).not.toContain('hidden');
    });

    it('keeps the clock from shrinking and from wrapping', async () => {
      await renderTopBar();

      const clock = screen.getByTestId('top-bar-clock-slot');

      expect(clock.className).toContain('shrink-0');
      expect(clock.className).toContain('whitespace-nowrap');
      expect(clock.querySelector('time')?.className).toContain('tabular-nums');
    });

    it('puts the clock between the search field and the profile menu', async () => {
      await renderTopBar();

      const clock = screen.getByTestId('top-bar-clock-slot');
      const searchField = screen.getByRole('searchbox', { name: defaultLocaleCatalog['search.label'] });
      const profileNode = screen.getByTestId(PROFILE_NODE_TEST_ID);

      expect(searchField.compareDocumentPosition(clock) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      expect(clock.compareDocumentPosition(profileNode) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it.each(VIEWPORT_CLASSES)('keeps the clock next to the profile menu in one group pushed to the end on a %s', async (viewportClass) => {
      await renderTopBar({ viewportClass });

      const clock = screen.getByTestId('top-bar-clock-slot');
      const profileNode = screen.getByTestId(PROFILE_NODE_TEST_ID);
      const trailingGroup = clock.parentElement;

      expect(profileNode.parentElement).toBe(trailingGroup);
      expect(clock.nextElementSibling).toBe(profileNode);
      expect(trailingGroup?.className).toContain('sm:ml-auto');
    });

    it('has the search field', async () => {
      await renderTopBar();

      expect(screen.getByRole('searchbox', { name: defaultLocaleCatalog['search.label'] })).toBeDefined();
    });
  });

  describe('profile menu slot', () => {
    it.each(VIEWPORT_CLASSES)('draws the node given by the application in the banner on a %s', async (viewportClass) => {
      await renderTopBar({ viewportClass });

      expect(within(screen.getByRole('banner')).getByTestId(PROFILE_NODE_TEST_ID)).toBeDefined();
    });

    it.each(VIEWPORT_CLASSES)('puts the node after the search field and the clock place on a %s', async (viewportClass) => {
      await renderTopBar({ viewportClass });

      const profileNode = screen.getByTestId(PROFILE_NODE_TEST_ID);
      const searchField = screen.getByRole('searchbox', { name: defaultLocaleCatalog['search.label'] });
      const clockSlot = screen.getByTestId('top-bar-clock-slot');

      expect(searchField.compareDocumentPosition(profileNode) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      expect(clockSlot.compareDocumentPosition(profileNode) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it.each(VIEWPORT_CLASSES)('keeps the node the last thing of the row on a %s', async (viewportClass) => {
      await renderTopBar({ viewportClass });

      const wrapper = screen.getByTestId(PROFILE_NODE_TEST_ID).parentElement;

      expect(wrapper?.parentElement?.lastElementChild).toBe(wrapper);
    });

    it('draws nothing in the slot when no node is given', async () => {
      await renderTopBar({ hasProfileMenu: false });

      expect(screen.queryByTestId(PROFILE_NODE_TEST_ID)).toBeNull();
    });

    it('keeps the very same node when the viewport class changes on the fly', async () => {
      const { viewport } = await renderTopBar({ viewportClass: 'desktop' });
      const node = screen.getByTestId(PROFILE_NODE_TEST_ID);

      for (const viewportClass of ['tablet', 'phone', 'desktop'] as const) {
        act(() => {
          viewport.setViewportClass(viewportClass);
        });

        expect(screen.getByTestId(PROFILE_NODE_TEST_ID)).toBe(node);
      }
    });
  });

  describe('what moved to the profile menu', () => {
    it.each(VIEWPORT_CLASSES)('has no sign-in line on a %s', async (viewportClass) => {
      await renderTopBar({ viewportClass });

      const banner = screen.getByRole('banner');

      expect(within(banner).queryByText(/Войти как/)).toBeNull();
      expect(within(banner).queryByRole('button', { name: /Войти как/ })).toBeNull();
    });

    it.each(VIEWPORT_CLASSES)('has no theme switcher on a %s', async (viewportClass) => {
      await renderTopBar({ viewportClass });

      const banner = screen.getByRole('banner');

      expect(within(banner).queryByRole('group', { name: defaultLocaleCatalog['theme.label'] })).toBeNull();
      expect(within(banner).queryByRole('radio')).toBeNull();
    });

    it.each(VIEWPORT_CLASSES)('has no reset button and no reset confirmation on a %s', async (viewportClass) => {
      await renderTopBar({ viewportClass });

      const banner = screen.getByRole('banner');

      expect(within(banner).queryByRole('button', { name: defaultLocaleCatalog['demo.reset.label'] })).toBeNull();
      expect(screen.queryByText(defaultLocaleCatalog['demo.reset.confirm.prompt'])).toBeNull();
    });

    it.each(VIEWPORT_CLASSES)('has no menu button on a %s', async (viewportClass) => {
      await renderTopBar({ viewportClass });

      expect(within(screen.getByRole('banner')).queryByRole('button', { hidden: true, name: /^Меню$/ })).toBeNull();
    });
  });
});
