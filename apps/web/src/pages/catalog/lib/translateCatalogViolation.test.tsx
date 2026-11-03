import type { ReactNode } from 'react';

import {
  renderHook,
  waitFor,
} from '@testing-library/react';
import {
  describe,
  expect,
  it,
} from 'vitest';

import { useCatalogSection } from '@/shared/i18n';
import { withTestLocalizer } from '@/shared/i18n/index.testing';

import type { CatalogEditorTranslate } from '../i18n/editor/editorSection';

import { catalogEditorSection } from '../i18n/editor/editorSection';
import { translateCatalogViolation } from './translateCatalogViolation';

const loadTranslate = async (): Promise<CatalogEditorTranslate> => {
  const { result } = renderHook(() => useCatalogSection(catalogEditorSection), {
    wrapper: ({ children }: { children: ReactNode }) => withTestLocalizer(<>{children}</>),
  });

  await waitFor(() => {
    expect(result.current.status).toBe('ready');
  });

  const { t } = result.current;

  if (t === undefined) {
    throw new Error('The catalog editor section is not ready');
  }

  return t;
};

describe('translation of the rules of the catalog', () => {
  it('turns the rule of the engine into the text of the section', async () => {
    const t = await loadTranslate();

    expect(translateCatalogViolation(t, 'catalog.tier_price_order')).toBe('Цена должна быть ниже, чем в предыдущей ступени');
    expect(translateCatalogViolation(t, 'catalog.listing_warehouse_required'))
      .toBe('Чтобы опубликовать позицию, укажите хотя бы один склад');
  });

  it('knows the generic rules of the numbers and of the money', async () => {
    const t = await loadTranslate();

    expect(translateCatalogViolation(t, 'int64.gt')).toBe('Число должно быть больше нуля');
    expect(translateCatalogViolation(t, 'money.currency_unsupported')).toBe('Пока доступны только рубли');
  });

  it('leaves the rules it does not know to the generic text of the field', async () => {
    const t = await loadTranslate();

    expect(translateCatalogViolation(t, 'required')).toBeUndefined();
    expect(translateCatalogViolation(t, 'catalog.unknown')).toBeUndefined();
  });
});
