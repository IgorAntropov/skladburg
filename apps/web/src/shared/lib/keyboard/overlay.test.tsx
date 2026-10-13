import {
  afterEach,
  describe,
  expect,
  it,
} from 'vitest';

import { isInsideOverlay } from './overlay';

const mount = (markup: string, selector: string): Element => {
  document.body.innerHTML = markup;
  const element = document.body.querySelector(selector);

  if (element === null) {
    throw new TypeError(`The element ${selector} is missing`);
  }

  return element;
};

describe('isInsideOverlay', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('is false without a target', () => {
    expect(isInsideOverlay(null)).toBe(false);
  });

  it('is false for a target that is not an element', () => {
    expect(isInsideOverlay(window)).toBe(false);
    expect(isInsideOverlay(document)).toBe(false);
  });

  it.each(['menu', 'dialog', 'alertdialog'])('is true for a child of the %s', (role) => {
    const element = mount(`<div role="${role}"><p><button id="target"></button></p></div>`, '#target');

    expect(isInsideOverlay(element)).toBe(true);
  });

  it('is true for the overlay itself', () => {
    const element = mount('<div id="target" role="dialog"></div>', '#target');

    expect(isInsideOverlay(element)).toBe(true);
  });

  it('is false for other roles and plain elements', () => {
    const element = mount('<div role="tablist"><button id="target"></button></div>', '#target');

    expect(isInsideOverlay(element)).toBe(false);
    expect(isInsideOverlay(document.body)).toBe(false);
  });
});
