import type { CatalogShapeValue } from '@/shared/i18n';

export const catalog = {
  'notification.link.map': 'Показать на карте',
  'notification.link.open': 'Открыть карточку',
  'notification.link.organization': 'Карточка компании',
  'notification.message.partnerVerified': 'Компания «{organizationName}» проверена, уровень {verificationLevel}',
  'notification.message.unknown': 'Новое уведомление',
  'notification.message.verificationNextLevel': 'Доступен уровень проверки {nextLevel}. Сейчас у вас уровень {currentLevel}',
  'notification.message.warehouseCreated': 'Создан склад «{warehouseName}» в городе {cityName}',
  'notification.panel.empty.hint': 'Сообщения о ваших складах и партнёрах появятся здесь',
  'notification.panel.empty.title': 'Пока тихо',
  'notification.panel.loading': 'Загружаем уведомления…',
  'notification.panel.markAllRead': 'Прочитать все',
  'notification.panel.markAllRead.done': 'Все уведомления прочитаны',
  'notification.panel.markAllRead.pending': 'Отмечаем…',
  'notification.panel.quietMode': 'Только важное',
  'notification.panel.quietMode.hint': 'Мелочи не всплывают, но видны в списке. Важное и критичное придёт как обычно',
  'notification.panel.title': 'Уведомления',
  'notification.row.unread': 'Не прочитано',
} as const satisfies CatalogShapeValue;
