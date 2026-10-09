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

import type { ObjectRefValue } from '@/shared/routing';

import { withTestLocalizer } from '@/shared/i18n/index.testing';
import { OBJECT_TYPES } from '@/shared/routing';

import { ObjectInspector } from './ObjectInspector';

const OBJECT_ID = 'f6000001-0000-4000-8000-000000000000';

const renderInspector = (focus: ObjectRefValue | undefined): ReturnType<typeof vi.fn> => {
  const onClose = vi.fn();

  render(withTestLocalizer(<ObjectInspector focus={focus} onClose={onClose} />));

  return onClose;
};

describe('ObjectInspector', () => {
  afterEach(() => {
    cleanup();
  });

  describe('without an object', () => {
    it('shows the title and the empty state', () => {
      renderInspector(undefined);

      expect(screen.getByRole('heading', { level: 2 }).textContent).toBe(defaultLocaleCatalog['hud.inspector.title']);
      expect(screen.getByText(defaultLocaleCatalog['hud.inspector.empty'])).toBeDefined();
    });

    it('draws the empty state as a quiet circle above a centered phrase', () => {
      renderInspector(undefined);
      const phrase = screen.getByText(defaultLocaleCatalog['hud.inspector.empty']);
      const root = phrase.parentElement;

      expect(root?.className).toContain('flex-col');
      expect(root?.className).toContain('text-center');
      expect(root?.className).not.toContain('flex-row');
      expect(root?.querySelector('span')?.className).toContain('bg-hover');
    });

    it('has no close button and never asks to close', () => {
      const onClose = renderInspector(undefined);

      expect(screen.queryByRole('button')).toBeNull();
      expect(onClose).not.toHaveBeenCalled();
    });
  });

  describe('with an object', () => {
    it.each(OBJECT_TYPES)('names the object of the type %s and keeps its identifier out of translation', (type) => {
      renderInspector({ id: OBJECT_ID, type });

      const identifier = screen.getByText(OBJECT_ID);

      expect(identifier.getAttribute('translate')).toBe('no');
      expect(identifier.closest('p')?.textContent).toBe(
        `${defaultLocaleCatalog['hud.inspector.object'].replace('{type}', defaultLocaleCatalog[`object.type.${type}`])} ${OBJECT_ID}`,
      );
    });

    it('lets a long identifier wrap', () => {
      renderInspector({ id: OBJECT_ID, type: 'deal' });

      expect(screen.getByText(OBJECT_ID).className).toContain('break-all');
    });

    it('does not show the empty state', () => {
      renderInspector({ id: OBJECT_ID, type: 'deal' });

      expect(screen.queryByText(defaultLocaleCatalog['hud.inspector.empty'])).toBeNull();
    });

    it('asks to close once when the close button is pressed', () => {
      const onClose = renderInspector({ id: OBJECT_ID, type: 'trip' });

      fireEvent.click(screen.getByRole('button', { name: defaultLocaleCatalog['hud.inspector.close'] }));

      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });
});
