import type { ReactNode } from 'react';

import { create } from '@bufbuild/protobuf';
import { timestampFromMs } from '@bufbuild/protobuf/wkt';
import {
  NotificationKind,
  NotificationSchema,
  PartnerVerifiedParamsSchema,
  SupportAccessParamsSchema,
  SupportReplyParamsSchema,
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

const formatTime = (instantMs: number): string => new Date(instantMs).toISOString().slice(11, 16);

const SUPPORT_ACCESS_PARAMS = {
  case: 'supportAccess',
  value: create(SupportAccessParamsSchema, {
    expiresAt: timestampFromMs(Date.UTC(2026, 9, 28, 14, 5)),
    sessionId: 'session-1',
    staffDisplayName: 'Анна Сергеева',
    ticketNumber: 1001,
  }),
} as const;

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

    expect(formatNotificationMessage(t, formatTime, notification)).toBe('Создан склад «Северный» в городе Тверь');
  });

  it('names the company and the level of a verified partner', async () => {
    const t = await loadTranslate();
    const notification = create(NotificationSchema, {
      params: {
        case: 'partnerVerified',
        value: create(PartnerVerifiedParamsSchema, { organizationName: 'Вкусный день', verificationLevel: 2 }),
      },
    });

    expect(formatNotificationMessage(t, formatTime, notification)).toBe('Компания «Вкусный день» проверена, уровень 2');
  });

  it('names both levels of the next verification step', async () => {
    const t = await loadTranslate();
    const notification = create(NotificationSchema, {
      params: {
        case: 'verificationNextLevel',
        value: create(VerificationNextLevelParamsSchema, { currentLevel: 2, nextLevel: 3 }),
      },
    });

    expect(formatNotificationMessage(t, formatTime, notification)).toBe('Доступен уровень проверки 3. Сейчас у вас уровень 2');
  });

  it('names the number of the support ticket that was answered without a thousands separator', async () => {
    const t = await loadTranslate();
    const notification = create(NotificationSchema, {
      params: {
        case: 'supportReply',
        value: create(SupportReplyParamsSchema, { ticketId: 'ticket-1', ticketNumber: 1001 }),
      },
    });

    expect(formatNotificationMessage(t, formatTime, notification)).toBe('Поддержка ответила по обращению №\u00a01001');
  });

  it('names the ticket number of a support access request without a thousands separator', async () => {
    const t = await loadTranslate();
    const notification = create(NotificationSchema, {
      kind: NotificationKind.SUPPORT_ACCESS_REQUESTED,
      params: SUPPORT_ACCESS_PARAMS,
    });

    expect(formatNotificationMessage(t, formatTime, notification)).toBe(
      'Поддержка просит доступ к данным компании по обращению №\u00a01001',
    );
  });

  it('names the staff member and the end time of an emergency access', async () => {
    const t = await loadTranslate();
    const notification = create(NotificationSchema, {
      kind: NotificationKind.SUPPORT_EMERGENCY_ACCESS_STARTED,
      params: SUPPORT_ACCESS_PARAMS,
    });

    expect(formatNotificationMessage(t, formatTime, notification)).toBe(
      'Экстренный доступ поддержки: Анна Сергеева, до 14:05',
    );
  });

  it('drops the end time of an emergency access that has none', async () => {
    const t = await loadTranslate();
    const notification = create(NotificationSchema, {
      kind: NotificationKind.SUPPORT_EMERGENCY_ACCESS_STARTED,
      params: {
        case: 'supportAccess',
        value: create(SupportAccessParamsSchema, { staffDisplayName: 'Анна Сергеева' }),
      },
    });

    expect(formatNotificationMessage(t, formatTime, notification)).toBe('Экстренный доступ поддержки: Анна Сергеева');
  });

  it('shows the unknown text for a foreign kind carrying support access params', async () => {
    const t = await loadTranslate();
    const notification = create(NotificationSchema, {
      kind: NotificationKind.SUPPORT_REPLY,
      params: SUPPORT_ACCESS_PARAMS,
    });

    expect(formatNotificationMessage(t, formatTime, notification)).toBe('Новое уведомление');
  });

  it('never shows an empty line for a kind without a text', async () => {
    const t = await loadTranslate();

    expect(formatNotificationMessage(t, formatTime, create(NotificationSchema, {}))).toBe('Новое уведомление');
  });
});
