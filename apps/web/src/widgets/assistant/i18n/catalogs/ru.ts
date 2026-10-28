import type { CatalogShapeValue } from '@/shared/i18n';

export const catalog = {
  'assistant.bubble.close': 'Скрыть',
  'assistant.bubble.label': '{assistantName} подсказывает',
  'assistant.digest.greeting': 'Здравствуйте! Вот что у вас сейчас',
  'assistant.digest.nextLevel': 'Вам доступен уровень проверки {nextLevel}',
  'assistant.digest.ownWarehouses': {
    few: 'У вас {count} склада',
    many: 'У вас {count} складов',
    one: 'У вас {count} склад',
    other: 'У вас {count} складов',
  },
  'assistant.digest.unread': {
    few: '{count} непрочитанных уведомления',
    many: '{count} непрочитанных уведомлений',
    one: '{count} непрочитанное уведомление',
    other: '{count} непрочитанных уведомлений',
  },
  'assistant.digest.verifiedCarriers': {
    few: '{count} проверенных перевозчика в сети',
    many: '{count} проверенных перевозчиков в сети',
    one: '{count} проверенный перевозчик в сети',
    other: '{count} проверенных перевозчиков в сети',
  },
  'assistant.digest.verifiedCustomers': {
    few: '{count} проверенных заказчика в сети',
    many: '{count} проверенных заказчиков в сети',
    one: '{count} проверенный заказчик в сети',
    other: '{count} проверенных заказчиков в сети',
  },
  'assistant.digest.verifiedPartners': {
    few: '{count} проверенных партнёра в сети',
    many: '{count} проверенных партнёров в сети',
    one: '{count} проверенный партнёр в сети',
    other: '{count} проверенных партнёров в сети',
  },
  'assistant.digest.verifiedSuppliers': {
    few: '{count} проверенных поставщика в сети',
    many: '{count} проверенных поставщиков в сети',
    one: '{count} проверенный поставщик в сети',
    other: '{count} проверенных поставщиков в сети',
  },
  'assistant.error.hint.idempotencyKeyReused':
    'Её приняли за повтор прежней операции и остановили. Проверьте, прошла ли первая',
  'assistant.error.hint.invalidTransition':
    'Объект уже сдвинулся дальше, вами или коллегой. Откройте карточку заново и проверьте статус',
  'assistant.error.hint.limitExceeded': 'Попросите коллегу с более высоким лимитом подтвердить операцию, и повторите её',
  'assistant.error.hint.membershipRequired': 'Возможно, открыта не та организация. Проверьте, от чьего имени вы работаете',
  'assistant.error.hint.notFound':
    'Объект могли удалить или закрыть для вашей организации. Проверьте ссылку или найдите его через поиск',
  'assistant.error.hint.permissionDenied':
    'У вашей роли этого действия нет. Если оно нужно по работе, скажите администратору',
  'assistant.error.hint.versionConflict': 'Сохранение остановили, чтобы не затереть чужие правки. Обновите карточку и повторите',
  'assistant.error.lead': 'Не вышло. {reason}',
  'assistant.link.center': 'Открыть уведомления',
  'assistant.link.map': 'Показать на карте',
  'assistant.link.open': 'Открыть карточку',
  'assistant.link.organization': 'Карточка компании',
  'assistant.replica.more': {
    few: 'Ещё {count} новых — в центре уведомлений',
    many: 'Ещё {count} новых — в центре уведомлений',
    one: 'Ещё {count} новое — в центре уведомлений',
    other: 'Ещё {count} новых — в центре уведомлений',
  },
  'assistant.replica.partnerVerified': 'Компанию «{organizationName}» проверили, теперь у неё уровень {verificationLevel}',
  'assistant.replica.supportAccessRequested': 'Поддержка просит доступ к данным компании по обращению № {ticketNumber}',
  'assistant.replica.supportEmergencyAccessStarted': 'Поддержка включила экстренный доступ к данным компании: {staff}',
  'assistant.replica.supportReply': 'Поддержка ответила на ваше обращение № {ticketNumber}',
  'assistant.replica.unknown': 'Пришло новое уведомление. Подробности в центре',
  'assistant.replica.verificationNextLevel':
    'Вам доступен уровень проверки {nextLevel}, сейчас у вас {currentLevel}. Загляните в карточку компании',
  'assistant.replica.warehouseCreated': 'Склад «{warehouseName}» в городе {cityName} заведён. Загляните, как он смотрится на карте',
} as const satisfies CatalogShapeValue;
