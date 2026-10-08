import { RuleTester } from 'eslint';
import tseslint from 'typescript-eslint';
import {
  describe,
  it,
} from 'vitest';

import { noRawControlsRule } from './no-raw-controls-rule.ts';

RuleTester.describe = describe;
RuleTester.it = it;

const ruleTester = new RuleTester({
  languageOptions: {
    parser: tseslint.parser,
    parserOptions: { ecmaFeatures: { jsx: true } },
  },
});

const reported = [{ messageId: 'rawControl' }];
const expectedTextareaMessage = 'Raw <textarea> belongs to shared/ui; use Button, DropdownMenu or another primitive from @/shared/ui';
const reportedTwice = [{ messageId: 'rawControl' }, { messageId: 'rawControl' }];

ruleTester.run('no-raw-controls', noRawControlsRule, {
  invalid: [
    { code: 'const view = <button>{label}</button>;', errors: reported },
    { code: 'const view = <button />;', errors: reported },
    { code: 'const view = <select>{options}</select>;', errors: reported },
    { code: 'const view = <input />;', errors: reported },
    { code: 'const view = <textarea>{value}</textarea>;', errors: reported },
    { code: 'const view = <button type="button" disabled onClick={handleClick}>{label}</button>;', errors: reported },
    { code: 'const view = <input type="text" value={value} onChange={handleChange} />;', errors: reported },
    { code: 'const view = <div><section><button>{label}</button></section></div>;', errors: reported },
    { code: 'const view = <form><input /><textarea /></form>;', errors: reportedTwice },
    { code: 'const view = <button><input /></button>;', errors: reportedTwice },
    { code: 'const view = <Card actions={<button />} />;', errors: reported },
    { code: 'const view = <>{items.map(item => <button key={item}>{item}</button>)}</>;', errors: reported },
    { code: 'const view = isOpen ? <select /> : <input />;', errors: reportedTwice },
    { code: 'const view = <textarea />;', errors: [{ message: expectedTextareaMessage }] },
  ],
  valid: [
    { code: 'const view = <Button>{label}</Button>;' },
    { code: 'const view = <ButtonGroup />;' },
    { code: 'const view = <Select />;' },
    { code: 'const view = <Input />;' },
    { code: 'const view = <Textarea />;' },
    { code: 'const view = <ui.button />;' },
    { code: 'const view = <ui.input></ui.input>;' },
    { code: 'const view = <this.button />;' },
    { code: 'const view = <svg:input />;' },
    { code: 'const view = <button-group />;' },
    { code: 'const view = <div />;' },
    { code: 'const view = <label htmlFor="input">{label}</label>;' },
    { code: 'const view = <div role="button" data-kind="input" />;' },
    { code: 'const text = \'<input>\';' },
    { code: 'const text = `<button>${label}</button>`;' },
    { code: 'const view = <p>{\'<select>\'}</p>;' },
    { code: 'const button = createButton(); const input = button;' },
  ],
});
