import type { ReactElement } from 'react';

import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import {
  useRef,
  useState,
} from 'react';
import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { useSlashHotkey } from './useSlashHotkey';

const LABELS = {
  choice: 'choice',
  editor: 'editor',
  notes: 'notes',
  other: 'other',
  search: 'search',
} as const;

const TEXTS = {
  confirm: 'confirm',
  hide: 'hide',
  item: 'item',
  option: 'one',
  typed: 'text',
} as const;

interface HarnessProps {
  onActivate?: (() => void) | undefined;
}

const Harness = ({ onActivate }: HarnessProps): ReactElement => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isShown, setIsShown] = useState(true);

  useSlashHotkey(inputRef, onActivate);

  const handleHideClick = (): void => {
    setIsShown(false);
  };

  return (
    <div>
      {isShown && <input aria-label={LABELS.search} ref={inputRef} />}
      <input aria-label={LABELS.other} />
      <textarea aria-label={LABELS.notes} />
      <select aria-label={LABELS.choice}><option>{TEXTS.option}</option></select>
      <div aria-label={LABELS.editor} contentEditable suppressContentEditableWarning tabIndex={0}>{TEXTS.typed}</div>
      <div role="menu"><button type="button">{TEXTS.item}</button></div>
      <div role="dialog"><button type="button">{TEXTS.confirm}</button></div>
      <button onClick={handleHideClick} type="button">{TEXTS.hide}</button>
    </div>
  );
};

const getSearch = (): HTMLElement => screen.getByRole('textbox', { name: LABELS.search });

const press = (init: KeyboardEventInit, target: Document | Element | Window = document.body): boolean => {
  return fireEvent.keyDown(target, init);
};

describe('useSlashHotkey', () => {
  afterEach(() => {
    cleanup();
  });

  it('focuses the field on the slash key and does not print the symbol', () => {
    render(<Harness />);

    const isNotPrevented = press({ code: 'Slash', key: '/' });

    expect(document.activeElement).toBe(getSearch());
    expect(isNotPrevented).toBe(false);
  });

  it('focuses the field on the key of the slash on the Russian layout that prints a dot', () => {
    render(<Harness />);

    const isNotPrevented = press({ code: 'Slash', key: '.' });

    expect(document.activeElement).toBe(getSearch());
    expect(isNotPrevented).toBe(false);
  });

  it('focuses the field on the slash typed with Shift on the Russian layout', () => {
    render(<Harness />);

    press({ code: 'Digit7', key: '/', shiftKey: true });

    expect(document.activeElement).toBe(getSearch());
  });

  it('does nothing on Shift with the slash code that prints a question mark', () => {
    render(<Harness />);

    const isNotPrevented = press({ code: 'Slash', key: '?', shiftKey: true });

    expect(document.activeElement).toBe(document.body);
    expect(isNotPrevented).toBe(true);
  });

  it('does nothing on other keys', () => {
    render(<Harness />);

    press({ code: 'KeyA', key: 'a' });

    expect(document.activeElement).toBe(document.body);
  });

  it.each([
    ['input', LABELS.other],
    ['textarea', LABELS.notes],
    ['select', LABELS.choice],
    ['contenteditable', LABELS.editor],
  ] as const)('lets the slash be typed into the %s', (_name, label) => {
    render(<Harness />);
    const target = screen.getByLabelText(label);
    target.focus();

    const isNotPrevented = press({ code: 'Slash', key: '/' }, target);

    expect(document.activeElement).toBe(target);
    expect(isNotPrevented).toBe(true);
  });

  it.each([
    ['Ctrl', { ctrlKey: true }],
    ['Meta', { metaKey: true }],
    ['Alt', { altKey: true }],
  ])('does nothing with %s', (_name, modifier) => {
    render(<Harness />);

    const isNotPrevented = press({ code: 'Slash', key: '/', ...modifier });

    expect(document.activeElement).toBe(document.body);
    expect(isNotPrevented).toBe(true);
  });

  it('does nothing during the composition', () => {
    render(<Harness />);

    const isNotPrevented = press({ code: 'Slash', isComposing: true, key: '/' });

    expect(document.activeElement).toBe(document.body);
    expect(isNotPrevented).toBe(true);
  });

  it.each(['menu', 'dialog'])('does nothing inside the open %s', (role) => {
    render(<Harness />);
    const item = within(screen.getByRole(role)).getByRole('button');
    item.focus();

    const isNotPrevented = press({ code: 'Slash', key: '/' }, item);

    expect(document.activeElement).toBe(item);
    expect(isNotPrevented).toBe(true);
  });

  it('does nothing when another handler has already taken the key', () => {
    render(<Harness />);
    const takeKey = (event: KeyboardEvent): void => {
      event.preventDefault();
    };
    window.addEventListener('keydown', takeKey, { capture: true });

    press({ code: 'Slash', key: '/' });
    window.removeEventListener('keydown', takeKey, { capture: true });

    expect(document.activeElement).toBe(document.body);
  });

  it('tells the owner about the activation', () => {
    const onActivate = vi.fn();
    render(<Harness onActivate={onActivate} />);

    press({ code: 'Slash', key: '/' });

    expect(onActivate).toHaveBeenCalledOnce();
  });

  it('is silent when the key is not the hotkey', () => {
    const onActivate = vi.fn();
    render(<Harness onActivate={onActivate} />);

    press({ code: 'KeyA', key: 'a' });

    expect(onActivate).not.toHaveBeenCalled();
  });

  it('stays quiet when the field is not on the screen', () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: TEXTS.hide }));

    const isNotPrevented = press({ code: 'Slash', key: '/' });

    expect(isNotPrevented).toBe(false);
    expect(document.activeElement).toBe(document.body);
  });

  it('stops listening when the owner is gone', () => {
    const onActivate = vi.fn();
    const { unmount } = render(<Harness onActivate={onActivate} />);
    unmount();

    press({ code: 'Slash', key: '/' });

    expect(onActivate).not.toHaveBeenCalled();
  });
});
