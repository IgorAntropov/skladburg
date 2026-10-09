import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { defaultLocaleCatalog } from 'virtual:build-profile';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest';

import {
  createLocalizer,
  LocalizerProvider,
} from '@/shared/i18n';

import { SearchField } from './SearchField';

const localizer = await createLocalizer({
  bundledLocales: ['ru'],
  catalogLoaders: { ru: () => Promise.resolve(defaultLocaleCatalog) },
  requestedLocale: undefined,
  tenant: { availableLocales: ['ru'], defaultLocale: 'ru', termOverrides: {} },
  userTimeZone: 'UTC',
});

const LABEL = defaultLocaleCatalog['search.label'];
const OPEN_LABEL = defaultLocaleCatalog['search.open'];
const UNAVAILABLE = defaultLocaleCatalog['search.unavailable'];

const PAGE_LINK_LABEL = 'Склад';

const renderField = (): void => {
  render(
    <LocalizerProvider localizer={localizer}>
      <a href="#warehouse">{PAGE_LINK_LABEL}</a>
      <SearchField />
    </LocalizerProvider>,
  );
};

const hideToggleLikeOnWideScreen = (): HTMLStyleElement => {
  const style = document.createElement('style');
  style.textContent = '.sm\\:hidden { display: none; }';
  document.head.append(style);

  return style;
};

const getPageLink = (): HTMLElement => screen.getByRole('link', { name: PAGE_LINK_LABEL });

const getInput = (): HTMLInputElement => {
  const input = screen.getByRole('searchbox', { name: LABEL });

  if (!(input instanceof HTMLInputElement)) {
    throw new TypeError('The search field is not an input');
  }

  return input;
};

const getToggle = (): HTMLElement => screen.getByRole('button', { name: OPEN_LABEL });

const getStatus = (): HTMLElement => screen.getByRole('status');

const type = (value: string): void => {
  fireEvent.change(getInput(), { target: { value } });
};

describe('SearchField', () => {
  afterEach(() => {
    cleanup();
  });

  it('is a labelled search field that announces its hotkey', () => {
    renderField();

    expect(getInput().getAttribute('aria-keyshortcuts')).toBe('/');
    expect(getInput().placeholder).toBe(defaultLocaleCatalog['search.placeholder']);
    expect(screen.getByRole('search')).toBeDefined();
  });

  it('keeps the label for assistive technology and ties it to the field', () => {
    renderField();
    const label = screen.getByText(LABEL, { selector: 'label' });

    expect(label.className).toContain('sr-only');
    expect(label.getAttribute('for')).toBe(getInput().id);
  });

  it('has an empty status line before anything is asked', () => {
    renderField();

    expect(getStatus().textContent).toBe('');
  });

  it('takes the typed text', () => {
    renderField();

    type('молоко');

    expect(getInput().value).toBe('молоко');
  });

  it('tells that the search is not ready yet on Enter and keeps the text', () => {
    renderField();
    type('молоко');

    fireEvent.keyDown(getInput(), { key: 'Enter' });

    expect(getStatus().textContent).toBe(UNAVAILABLE);
    expect(getInput().value).toBe('молоко');
  });

  it('does not tell it while the text is being composed', () => {
    renderField();
    type('мол');

    fireEvent.keyDown(getInput(), { isComposing: true, key: 'Enter' });

    expect(getStatus().textContent).toBe('');
  });

  it('takes the message away when the text changes', () => {
    renderField();
    fireEvent.keyDown(getInput(), { key: 'Enter' });

    type('м');

    expect(getStatus().textContent).toBe('');
  });

  it('puts the message into a new node on every Enter so that it is read again', () => {
    renderField();

    fireEvent.keyDown(getInput(), { key: 'Enter' });
    const first = getStatus().firstElementChild;
    fireEvent.keyDown(getInput(), { key: 'Enter' });

    expect(getStatus().textContent).toBe(UNAVAILABLE);
    expect(getStatus().firstElementChild).not.toBe(first);
  });

  it('clears the text and the message and leaves the field on Escape', () => {
    renderField();
    getInput().focus();
    type('молоко');
    fireEvent.keyDown(getInput(), { key: 'Enter' });

    fireEvent.keyDown(getInput(), { key: 'Escape' });

    expect(getInput().value).toBe('');
    expect(getStatus().textContent).toBe('');
    expect(document.activeElement).not.toBe(getInput());
    expect(document.activeElement).not.toBe(document.body);
  });

  it('returns the focus to the element that had it before the slash key on Escape', () => {
    renderField();
    getPageLink().focus();

    fireEvent.keyDown(getPageLink(), { code: 'Slash', key: '/' });

    expect(document.activeElement).toBe(getInput());

    type('молоко');
    fireEvent.keyDown(getInput(), { key: 'Escape' });

    expect(getInput().value).toBe('');
    expect(document.activeElement).toBe(getPageLink());
  });

  it('does not return the focus to an element that has left the document', () => {
    renderField();
    const outsider = document.createElement('button');
    document.body.append(outsider);
    outsider.focus();
    fireEvent.keyDown(outsider, { code: 'Slash', key: '/' });
    outsider.remove();

    fireEvent.keyDown(getInput(), { key: 'Escape' });

    expect(document.activeElement).not.toBe(document.body);
  });

  it('turns the browser helpers off for the field', () => {
    renderField();

    expect(getInput().name).toBe('search');
    expect(getInput().autocomplete).toBe('off');
    expect(getInput().getAttribute('spellcheck')).toBe('false');
  });

  it('ignores other keys', () => {
    renderField();
    type('молоко');

    fireEvent.keyDown(getInput(), { key: 'a' });

    expect(getInput().value).toBe('молоко');
    expect(getStatus().textContent).toBe('');
  });

  describe('on a phone', () => {
    it('hides the field behind a collapsed button', () => {
      renderField();
      const toggle = getToggle();

      expect(toggle.getAttribute('aria-expanded')).toBe('false');
      expect(toggle.className).toContain('sm:hidden');
      expect(screen.getByRole('search').className).toContain('max-sm:hidden');
    });

    it('points the button at the field', () => {
      renderField();

      expect(getToggle().getAttribute('aria-controls')).toBe(screen.getByRole('search').id);
    });

    it('opens the field below the panel and puts the focus into it on the button', async () => {
      renderField();

      fireEvent.click(getToggle());

      expect(getToggle().getAttribute('aria-expanded')).toBe('true');
      expect(screen.getByRole('search').className).not.toContain('max-sm:hidden');
      expect(screen.getByRole('search').className).toContain('max-sm:basis-full');
      await waitFor(() => {
        expect(document.activeElement).toBe(getInput());
      });
    });

    it('closes the field on the second press of the button', () => {
      renderField();
      fireEvent.click(getToggle());

      fireEvent.click(getToggle());

      expect(getToggle().getAttribute('aria-expanded')).toBe('false');
      expect(screen.getByRole('search').className).toContain('max-sm:hidden');
    });

    it('opens the field and focuses it on the slash key', async () => {
      renderField();

      fireEvent.keyDown(document.body, { code: 'Slash', key: '/' });

      expect(getToggle().getAttribute('aria-expanded')).toBe('true');
      await waitFor(() => {
        expect(document.activeElement).toBe(getInput());
      });
    });

    it('folds the field and returns the focus to the button on Escape', async () => {
      renderField();
      fireEvent.click(getToggle());
      await waitFor(() => {
        expect(document.activeElement).toBe(getInput());
      });
      type('молоко');

      fireEvent.keyDown(getInput(), { key: 'Escape' });

      expect(getToggle().getAttribute('aria-expanded')).toBe('false');
      expect(document.activeElement).toBe(getToggle());
      expect(getInput().value).toBe('');
    });
  });

  describe('on a wide screen', () => {
    let style: HTMLStyleElement | undefined;

    beforeEach(() => {
      style = hideToggleLikeOnWideScreen();
    });

    afterEach(() => {
      style?.remove();
    });

    it('keeps the focus in the cleared field on Escape when nothing had it before the slash key', () => {
      renderField();

      fireEvent.keyDown(document.body, { code: 'Slash', key: '/' });
      type('молоко');
      fireEvent.keyDown(getInput(), { key: 'Escape' });

      expect(getInput().value).toBe('');
      expect(document.activeElement).toBe(getInput());
    });

    it('returns the focus to the page link on Escape after the slash key pressed on it', () => {
      renderField();
      getPageLink().focus();

      fireEvent.keyDown(getPageLink(), { code: 'Slash', key: '/' });
      type('молоко');
      fireEvent.keyDown(getInput(), { key: 'Escape' });

      expect(getInput().value).toBe('');
      expect(document.activeElement).toBe(getPageLink());
    });

    it('focuses the field on the slash key from the page', () => {
      renderField();

      fireEvent.keyDown(document.body, { code: 'Slash', key: '.' });

      expect(document.activeElement).toBe(getInput());
    });

    it('lets the slash be typed once the field has the focus', () => {
      renderField();
      getInput().focus();

      const isNotPrevented = fireEvent.keyDown(getInput(), { code: 'Slash', key: '/' });

      expect(isNotPrevented).toBe(true);
    });
  });
});
