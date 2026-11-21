import type { ReactNode } from 'react';

import {
  create,
  fromJson,
} from '@bufbuild/protobuf';
import { timestampFromMs } from '@bufbuild/protobuf/wkt';
import {
  DealNotice,
  DealUpdateParamsSchema,
  type Notification,
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

import {
  useCatalogSection,
  useI18n,
} from '@/shared/i18n';
import { withTestLocalizer } from '@/shared/i18n/index.testing';

import { notificationSection } from '../../i18n/notificationSection';
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

const loadFormatter = async (): Promise<(notification: Notification) => string> => {
  const { result } = renderHook(() => ({
    ...useCatalogSection(notificationSection),
    createSectionTranslator: useI18n().createSectionTranslator,
  }), {
    wrapper: ({ children }: { children: ReactNode }) => withTestLocalizer(<>{children}</>),
  });

  await waitFor(() => {
    expect(result.current.status).toBe('ready');
  });

  const { createSectionTranslator, t } = result.current;

  if (t === undefined) {
    throw new Error('The notification section is not ready');
  }

  return notification => formatNotificationMessage(t, formatTime, createSectionTranslator, notification);
};

describe('formatNotificationMessage', () => {
  it('reports the measured temperature and switches to the confirmed recovery of the same alert', async () => {
    const format = await loadFormatter();
    const alert = { openedDeciCelsius: 85, thresholdDeciCelsius: 80, zoneCode: 'Z01' };
    const opened = create(NotificationSchema, { params: { case: 'warehouseSensorAlert', value: alert } });
    expect(format(opened)).toBe('Тревога в зоне Z01. Температура 8,5\u00a0°C при пороге 8\u00a0°C');

    const resolved = { ...alert, resolvedAt: timestampFromMs(420_000) };
    const closed = create(NotificationSchema, {
      params: { case: 'warehouseSensorAlert', value: { ...resolved, resolvedDeciCelsius: 70 } },
    });
    expect(format(closed)).toBe('Температура в норме. В зоне Z01 датчик зафиксировал 7\u00a0°C');
    const withoutReading = create(NotificationSchema, { params: { case: 'warehouseSensorAlert', value: resolved } });
    expect(format(withoutReading)).toBe('Температура в норме. Тревога в зоне Z01 закрыта');
  });

  it('puts the names and numbers of a created warehouse into the text', async () => {
    const format = await loadFormatter();
    const notification = create(NotificationSchema, {
      params: {
        case: 'warehouseCreated',
        value: create(WarehouseCreatedParamsSchema, { cityName: 'Тверь', warehouseName: 'Северный' }),
      },
    });

    expect(format(notification)).toBe('Создан склад «Северный» в городе Тверь');
  });

  it('names the company and the level of a verified partner', async () => {
    const format = await loadFormatter();
    const notification = create(NotificationSchema, {
      params: {
        case: 'partnerVerified',
        value: create(PartnerVerifiedParamsSchema, { organizationName: 'Вкусный день', verificationLevel: 2 }),
      },
    });

    expect(format(notification)).toBe('Компания «Вкусный день» проверена, уровень 2');
  });

  it('names both levels of the next verification step', async () => {
    const format = await loadFormatter();
    const notification = create(NotificationSchema, {
      params: {
        case: 'verificationNextLevel',
        value: create(VerificationNextLevelParamsSchema, { currentLevel: 2, nextLevel: 3 }),
      },
    });

    expect(format(notification)).toBe('Доступен уровень проверки 3. Сейчас у вас уровень 2');
  });

  it('names the number of the support ticket that was answered without a thousands separator', async () => {
    const format = await loadFormatter();
    const notification = create(NotificationSchema, {
      params: {
        case: 'supportReply',
        value: create(SupportReplyParamsSchema, { ticketId: 'ticket-1', ticketNumber: 1001 }),
      },
    });

    expect(format(notification)).toBe('Поддержка ответила по обращению №\u00a01001');
  });

  it('names the ticket number of a support access request without a thousands separator', async () => {
    const format = await loadFormatter();
    const notification = create(NotificationSchema, {
      kind: NotificationKind.SUPPORT_ACCESS_REQUESTED,
      params: SUPPORT_ACCESS_PARAMS,
    });

    expect(format(notification)).toBe(
      'Поддержка просит доступ к данным компании по обращению №\u00a01001',
    );
  });

  it('names the staff member and the end time of an emergency access', async () => {
    const format = await loadFormatter();
    const notification = create(NotificationSchema, {
      kind: NotificationKind.SUPPORT_EMERGENCY_ACCESS_STARTED,
      params: SUPPORT_ACCESS_PARAMS,
    });

    expect(format(notification)).toBe(
      'Экстренный доступ поддержки: Анна Сергеева, до 14:05',
    );
  });

  it('drops the end time of an emergency access that has none', async () => {
    const format = await loadFormatter();
    const notification = create(NotificationSchema, {
      kind: NotificationKind.SUPPORT_EMERGENCY_ACCESS_STARTED,
      params: {
        case: 'supportAccess',
        value: create(SupportAccessParamsSchema, { staffDisplayName: 'Анна Сергеева' }),
      },
    });

    expect(format(notification)).toBe('Экстренный доступ поддержки: Анна Сергеева');
  });

  it('shows the unknown text for a foreign kind carrying support access params', async () => {
    const format = await loadFormatter();
    const notification = create(NotificationSchema, {
      kind: NotificationKind.SUPPORT_REPLY,
      params: SUPPORT_ACCESS_PARAMS,
    });

    expect(format(notification)).toBe('Новое уведомление');
  });

  it('selects the deal notice and preserves the deal number and counterparty', async () => {
    const format = await loadFormatter();
    const notification = create(NotificationSchema, {
      kind: NotificationKind.DEAL_UPDATE,
      params: {
        case: 'dealUpdate',
        value: create(DealUpdateParamsSchema, {
          counterpartyName: 'Яблоневый край',
          dealNumber: 1001,
          notice: DealNotice.CONFIRMED,
        }),
      },
    });

    expect(format(notification)).toBe(
      'Условия заказа №\u00a01001 с компанией «Яблоневый край» согласованы',
    );
  });

  it('keeps an unknown deal notice readable', async () => {
    const format = await loadFormatter();
    const notification = create(NotificationSchema, {
      kind: NotificationKind.DEAL_UPDATE,
      params: { case: 'dealUpdate', value: fromJson(DealUpdateParamsSchema, { notice: 999 }) },
    });

    expect(format(notification)).toBe('Новое уведомление');
  });

  it('never shows an empty line for a kind without a text', async () => {
    const format = await loadFormatter();

    expect(format(create(NotificationSchema, {}))).toBe('Новое уведомление');
  });
});
