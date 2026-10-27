import type { ReactNode } from 'react';

import { create } from '@bufbuild/protobuf';
import {
  NotificationSchema,
  PartnerVerifiedParamsSchema,
  VerificationNextLevelParamsSchema,
  WarehouseCreatedParamsSchema,
} from '@skladburg/contracts/notification/v1/notification';
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

import type { NotificationTranslate } from './formatNotificationMessage';

import { notificationSection } from '../i18n/notificationSection';
import { formatNotificationMessage } from './formatNotificationMessage';

const loadTranslate = async (): Promise<NotificationTranslate> => {
  const { result } = renderHook(() => useCatalogSection(notificationSection), {
    wrapper: ({ children }: { children: ReactNode }) => withTestLocalizer(<>{children}</>),
  });

  await waitFor(() => {
    expect(result.current.status).toBe('ready');
  });

  const { t } = result.current;

  if (t === undefined) {
    throw new Error('The notification section is not ready');
  }

  return t;
};

describe('formatNotificationMessage', () => {
  it('puts the names and numbers of a created warehouse into the text', async () => {
    const t = await loadTranslate();
    const notification = create(NotificationSchema, {
      params: {
        case: 'warehouseCreated',
        value: create(WarehouseCreatedParamsSchema, { cityName: 'Тверь', warehouseName: 'Северный' }),
      },
    });

    expect(formatNotificationMessage(t, notification)).toBe('Создан склад «Северный» в городе Тверь');
  });

  it('names the company and the level of a verified partner', async () => {
    const t = await loadTranslate();
    const notification = create(NotificationSchema, {
      params: {
        case: 'partnerVerified',
        value: create(PartnerVerifiedParamsSchema, { organizationName: 'Вкусный день', verificationLevel: 2 }),
      },
    });

    expect(formatNotificationMessage(t, notification)).toBe('Компания «Вкусный день» проверена, уровень 2');
  });

  it('names both levels of the next verification step', async () => {
    const t = await loadTranslate();
    const notification = create(NotificationSchema, {
      params: {
        case: 'verificationNextLevel',
        value: create(VerificationNextLevelParamsSchema, { currentLevel: 2, nextLevel: 3 }),
      },
    });

    expect(formatNotificationMessage(t, notification)).toBe('Доступен уровень проверки 3. Сейчас у вас уровень 2');
  });

  it('never shows an empty line for a kind without a text', async () => {
    const t = await loadTranslate();

    expect(formatNotificationMessage(t, create(NotificationSchema, {}))).toBe('Новое уведомление');
  });
});
