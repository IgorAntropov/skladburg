import type { SectionLocaleCatalogValue } from '@/shared/i18n';

import { catalog as formalCatalog } from './ru';

export const catalog: SectionLocaleCatalogValue<typeof formalCatalog> = {
  ...formalCatalog,
  'assistant.digest.greeting': 'Привет! Вот что у тебя сейчас',
  'assistant.digest.nextLevel': 'Тебе доступен уровень проверки {nextLevel}',
  'assistant.digest.ownWarehouses': {
    few: 'У тебя {count} склада',
    many: 'У тебя {count} складов',
    one: 'У тебя {count} склад',
    other: 'У тебя {count} складов',
  },
  'assistant.error.hint.idempotencyKeyReused':
    'Её приняли за повтор прежней операции и остановили. Проверь, прошла ли первая',
  'assistant.error.hint.invalidTransition':
    'Объект уже сдвинулся дальше, тобой или коллегой. Открой карточку заново и проверь статус',
  'assistant.error.hint.limitExceeded': 'Попроси коллегу с более высоким лимитом подтвердить операцию, и повтори её',
  'assistant.error.hint.membershipRequired': 'Возможно, открыта не та организация. Проверь, от чьего имени ты работаешь',
  'assistant.error.hint.notFound': 'Объект могли удалить или закрыть для твоей организации. Проверь ссылку или найди его через поиск',
  'assistant.error.hint.permissionDenied':
    'У твоей роли этого действия нет. Если оно нужно по работе, скажи администратору',
  'assistant.error.hint.versionConflict': 'Сохранение остановили, чтобы не затереть чужие правки. Обнови карточку и повтори',
  'assistant.replica.supportAccessRequested': 'Поддержка просит доступ к данным твоей компании по обращению №\u00a0{ticketNumber}',
  'assistant.replica.supportEmergencyAccessStarted': 'Поддержка включила экстренный доступ к данным твоей компании: {staff}',
  'assistant.replica.supportReply': 'Поддержка ответила на твоё обращение №\u00a0{ticketNumber}',
  'assistant.replica.verificationNextLevel':
    'Тебе доступен уровень проверки {nextLevel}, сейчас у тебя {currentLevel}. Загляни в карточку компании',
  'assistant.replica.warehouseCreated': 'Склад «{warehouseName}» в городе {cityName} заведён. Загляни, как он смотрится на карте',
};
