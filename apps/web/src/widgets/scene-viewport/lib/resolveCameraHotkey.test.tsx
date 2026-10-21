import {
  afterEach,
  describe,
  expect,
  it,
} from 'vitest';

import type { SceneCameraCommandValue } from '../model/useSceneCameraStore';
import type { CameraHotkeyEventValue } from './resolveCameraHotkey';

import { resolveCameraHotkey } from './resolveCameraHotkey';

const createEvent = (overrides: Partial<CameraHotkeyEventValue> = {}): CameraHotkeyEventValue => ({
  altKey: false,
  code: 'KeyE',
  ctrlKey: false,
  defaultPrevented: false,
  isComposing: false,
  metaKey: false,
  repeat: false,
  target: document.body,
  ...overrides,
});

const mount = (markup: string, selector: string): Element => {
  document.body.innerHTML = markup;
  const element = document.body.querySelector(selector);

  if (element === null) {
    throw new TypeError(`The element ${selector} is missing`);
  }

  return element;
};

describe('resolveCameraHotkey', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it.each<[string, SceneCameraCommandValue]>([
    ['KeyQ', { direction: -1, kind: 'rotate' }],
    ['KeyE', { direction: 1, kind: 'rotate' }],
    ['Home', { kind: 'home' }],
    ['Equal', { direction: 1, kind: 'zoom' }],
    ['NumpadAdd', { direction: 1, kind: 'zoom' }],
    ['Minus', { direction: -1, kind: 'zoom' }],
    ['NumpadSubtract', { direction: -1, kind: 'zoom' }],
  ])('turns %s into a command', (code, command) => {
    expect(resolveCameraHotkey(createEvent({ code }))).toEqual(command);
  });

  it.each(['KeyA', 'Slash', 'End', 'constructor', 'toString', ''])('ignores the code "%s"', (code) => {
    expect(resolveCameraHotkey(createEvent({ code }))).toBeUndefined();
  });

  it.each([
    ['Ctrl', { ctrlKey: true }],
    ['Meta', { metaKey: true }],
    ['Alt', { altKey: true }],
  ])('ignores the key with %s', (_name, modifier) => {
    expect(resolveCameraHotkey(createEvent({ code: 'Equal', ...modifier }))).toBeUndefined();
  });

  it('ignores the key during the composition', () => {
    expect(resolveCameraHotkey(createEvent({ isComposing: true }))).toBeUndefined();
  });

  it('ignores the key another handler has already taken', () => {
    expect(resolveCameraHotkey(createEvent({ code: 'Home', defaultPrevented: true }))).toBeUndefined();
  });

  it.each(['KeyQ', 'KeyE', 'Home'])('ignores the autorepeat of %s', (code) => {
    expect(resolveCameraHotkey(createEvent({ code, repeat: true }))).toBeUndefined();
  });

  it.each(['Equal', 'NumpadAdd', 'Minus', 'NumpadSubtract'])('keeps the autorepeat of %s for the zoom', (code) => {
    expect(resolveCameraHotkey(createEvent({ code, repeat: true }))?.kind).toBe('zoom');
  });

  it.each(['input', 'textarea', 'select'])('ignores the key inside the %s', (tagName) => {
    const target = mount(`<${tagName} id="target"></${tagName}>`, '#target');

    expect(resolveCameraHotkey(createEvent({ target }))).toBeUndefined();
  });

  it('ignores the key inside a contenteditable element', () => {
    const target = mount('<div contenteditable="true"><b id="target">text</b></div>', '#target');

    expect(resolveCameraHotkey(createEvent({ target }))).toBeUndefined();
  });

  it.each(['menu', 'dialog', 'alertdialog'])('ignores the key inside the %s', (role) => {
    const target = mount(`<div role="${role}"><button id="target"></button></div>`, '#target');

    expect(resolveCameraHotkey(createEvent({ target }))).toBeUndefined();
  });

  it.each([
    '<ul><li><button id="target"></button></li></ul>',
    '<ol><li><button id="target"></button></li></ol>',
    '<div role="grid"><div><button id="target"></button></div></div>',
    '<div role="listbox"><div id="target" role="option"></div></div>',
    '<div role="tree"><div id="target" role="treeitem"></div></div>',
    '<div role="treegrid"><div id="target" role="row"></div></div>',
  ])('does not give Home to the camera inside a list: %s', (markup) => {
    const target = mount(markup, '#target');

    expect(resolveCameraHotkey(createEvent({ code: 'Home', target }))).toBeUndefined();
  });

  it.each(['KeyQ', 'KeyE', 'Equal', 'NumpadAdd', 'Minus', 'NumpadSubtract'])('keeps %s working inside a list', (code) => {
    const target = mount('<ul><li><button id="target"></button></li></ul>', '#target');

    expect(resolveCameraHotkey(createEvent({ code, target }))).toBeDefined();
  });

  it('gives Home to the camera on a button outside the lists', () => {
    const target = mount('<div><button id="target"></button></div>', '#target');

    expect(resolveCameraHotkey(createEvent({ code: 'Home', target }))).toEqual({ kind: 'home' });
  });

  it('works on a button and a plain element', () => {
    const target = mount('<button id="target"></button>', '#target');

    expect(resolveCameraHotkey(createEvent({ target }))?.kind).toBe('rotate');
    expect(resolveCameraHotkey(createEvent({ target: null }))?.kind).toBe('rotate');
  });
});
