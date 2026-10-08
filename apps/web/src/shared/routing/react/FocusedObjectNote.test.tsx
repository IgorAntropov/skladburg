import {
  cleanup,
  render,
  screen,
} from '@testing-library/react';
import { defaultLocaleCatalog } from 'virtual:build-profile';
import {
  afterEach,
  describe,
  expect,
  it,
} from 'vitest';

import type { ILocalizer } from '@/shared/i18n';

import {
  createLocalizer,
  LocalizerProvider,
} from '@/shared/i18n';

import type { ObjectRefValue } from '../address/addressTypes';

import { OBJECT_TYPES } from '../address/addressTypes';
import { FocusedObjectNote } from './FocusedObjectNote';

const OBJECT_ID = 'f6000001-0000-4000-8000-000000000000';

const createTestLocalizer = (): Promise<ILocalizer> => createLocalizer({
  bundledLocales: ['ru'],
  catalogLoaders: { ru: () => Promise.resolve(defaultLocaleCatalog) },
  requestedLocale: undefined,
  tenant: { availableLocales: ['ru'], defaultLocale: 'ru', termOverrides: {} },
  userTimeZone: 'UTC',
});

const renderNote = async (focus: ObjectRefValue): Promise<void> => {
  const localizer = await createTestLocalizer();

  render(
    <LocalizerProvider localizer={localizer}>
      <FocusedObjectNote focus={focus} />
    </LocalizerProvider>,
  );
};

describe('FocusedObjectNote', () => {
  afterEach(() => {
    cleanup();
  });

  it.each(OBJECT_TYPES)('names the type %s of the opened object in the catalog language', async (type) => {
    await renderNote({ id: OBJECT_ID, type });

    const expectedText = defaultLocaleCatalog['routing.focusedObject'].replace('{type}', defaultLocaleCatalog[`object.type.${type}`]);

    expect(screen.getByText(OBJECT_ID).closest('p')?.textContent).toBe(`${expectedText} ${OBJECT_ID}`);
  });

  it('keeps the identifier out of translation', async () => {
    await renderNote({ id: OBJECT_ID, type: 'deal' });

    expect(screen.getByText(OBJECT_ID).getAttribute('translate')).toBe('no');
  });
});
