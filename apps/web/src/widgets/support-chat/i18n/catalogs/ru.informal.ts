import type { SectionLocaleCatalogValue } from '@/shared/i18n';

import { catalog as formalCatalog } from './ru';

export const catalog: SectionLocaleCatalogValue<typeof formalCatalog> = {
  ...formalCatalog,
  'support.form.intro': 'Выбери тему. Писать ничего не нужно, остальное соберём сами',
  'support.list.empty.hint':
    'Поддержка увидит, на каком экране это случилось и что сломалось. Имя, телефон и почту не отправляем',
  'support.list.empty.text': 'Не получилось разобраться? Позови человека из поддержки',
  'support.preview.session.note': 'Берём из твоего входа',
  'support.ticket.waiting.hint': 'Пока ждёшь, можно работать как обычно. Ответ придёт сюда и в уведомления',
};
