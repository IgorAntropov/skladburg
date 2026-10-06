import { RuleTester } from 'eslint';
import tseslint from 'typescript-eslint';
import {
  describe,
  it,
} from 'vitest';

import { noUiStringsRule } from './no-ui-strings-rule.ts';

RuleTester.describe = describe;
RuleTester.it = it;

const ruleTester = new RuleTester({
  languageOptions: {
    parser: tseslint.parser,
    parserOptions: { ecmaFeatures: { jsx: true } },
  },
});

const reported = [{ messageId: 'uiStringInJsx' }];
const reportedTwice = [{ messageId: 'uiStringInJsx' }, { messageId: 'uiStringInJsx' }];

ruleTester.run('no-ui-strings', noUiStringsRule, {
  invalid: [
    { code: 'const view = <main>Склад</main>;', errors: reported },
    { code: 'const view = <main>Warehouse</main>;', errors: reported },
    { code: 'const view = <main><b>Hello</b> world</main>;', errors: reportedTwice },
    { code: 'const view = <>Склад</>;', errors: reported },
    { code: 'const view = <main>{\'Склад\'}</main>;', errors: reported },
    { code: 'const view = <main>{"Warehouse"}</main>;', errors: reported },
    { code: 'const view = <main>{`Склад`}</main>;', errors: reported },
    { code: 'const view = <main>{`${count} items`}</main>;', errors: reported },
    { code: 'const view = <main>{isEmpty && `${count} шт`}</main>;', errors: reported },
    { code: 'const view = <main>{isReady ? \'Да\' : \'Нет\'}</main>;', errors: reportedTwice },
    { code: 'const view = <main>{isReady ? t(\'ready\') : \'Нет\'}</main>;', errors: reported },
    { code: 'const view = <main>{isReady ? (isEmpty ? \'Пусто\' : t(\'full\')) : t(\'none\')}</main>;', errors: reported },
    { code: 'const view = <main>{isEmpty && \'Пусто\'}</main>;', errors: reported },
    { code: 'const view = <main>{isEmpty || isHidden && `Скрыто`}</main>;', errors: reported },
    { code: 'const view = <input alt="Фото" />;', errors: reported },
    { code: 'const view = <input aria-description="Описание" />;', errors: reported },
    { code: 'const view = <input aria-label="Поиск" />;', errors: reported },
    { code: 'const view = <input aria-placeholder="Введите" />;', errors: reported },
    { code: 'const view = <input aria-roledescription="Кнопка" />;', errors: reported },
    { code: 'const view = <input aria-valuetext="Пять" />;', errors: reported },
    { code: 'const view = <input label="Name" />;', errors: reported },
    { code: 'const view = <input placeholder="Поиск" />;', errors: reported },
    { code: 'const view = <button title="Закрыть" />;', errors: reported },
    { code: 'const view = <button title={\'Закрыть\'} />;', errors: reported },
    { code: 'const view = <button title={`Закрыть`} />;', errors: reported },
    { code: 'const view = <button title={`Закрыть ${name}`} />;', errors: reported },
    { code: 'const view = <button title={isOpen ? \'Закрыть\' : \'Открыть\'} />;', errors: reportedTwice },
    { code: 'const view = <button title={isOpen && \'Закрыть\'} />;', errors: reported },
    {
      code: 'const view = <input data-hint="Подсказка" />;',
      errors: reported,
      options: [{ attributes: ['data-hint'] }],
    },
    {
      code: 'const view = <input data-hint="Подсказка" title="Заголовок" />;',
      errors: reported,
      options: [{ attributes: ['data-hint'] }],
    },
  ],
  valid: [
    'const view = <main className="flex items-center" />;',
    'const view = <main data-testid="field-page" />;',
    'const view = <main id="root" />;',
    'const view = <main translate="no" />;',
    'const view = <main role="button" />;',
    'const view = <input type="text" />;',
    'const view = <main lang="ru" />;',
    'const view = <main>{brandName}</main>;',
    'const view = <main>{t(\'field.placeholder\')}</main>;',
    'const view = <input placeholder={t(\'field.placeholder\')} />;',
    'const view = <input title={brandName} />;',
    'const view = <main>·</main>;',
    'const view = <main>—</main>;',
    'const view = <main>:</main>;',
    'const view = <main>42</main>;',
    'const view = <main>{\'·\'}</main>;',
    'const view = <main>{`42`}</main>;',
    'const view = <main>{isReady ? \'·\' : \'—\'}</main>;',
    'const view = <main>{isEmpty && \'-\'}</main>;',
    'const view = <input title="42" />;',
    'const view = <main>{`${first}${second}`}</main>;',
    'const view = <main>{`${a} ${b}`}</main>;',
    'const view = <button title={`${first}${second}`} />;',
    'const view = <main>{items.length > 0 && count}</main>;',
    'const view = <main>{\'Склад\' && count}</main>;',
    'const view = <main>{\'Склад\' ? count : brandName}</main>;',
    'const view = <main className={isOpen ? \'open\' : \'closed\'} />;',
    'const view = <main className={`flex ${isOpen ? \'open\' : \'closed\'}`} />;',
    'const view = <main>{items.map(item => item.name)}</main>;',
    'const view = <main>{items.filter(item => item.kind === \'pallet\')}</main>;',
    'const view = <main onClick={() => select(\'pallet\')} />;',
    'const label = \'Склад\';',
    'const text = `Склад`;',
    'const view = <Table columns={[\'name\', \'count\']} />;',
    {
      code: 'const view = <input title="Заголовок" />;',
      options: [{ attributes: ['data-hint'] }],
    },
    {
      code: 'const view = <input title="Заголовок" aria-label="Поиск" />;',
      options: [{ attributes: [] }],
    },
  ],
});
