import {
  afterEach,
  describe,
  expect,
  it,
} from 'vitest';

import { isEditableTarget } from './isEditableTarget';

const mount = (markup: string, selector: string): Element => {
  document.body.innerHTML = markup;
  const element = document.body.querySelector(selector);

  if (element === null) {
    throw new TypeError(`The element ${selector} is missing`);
  }

  return element;
};

describe('isEditableTarget', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('is false without a target', () => {
    expect(isEditableTarget(null)).toBe(false);
  });

  it('is false for a target that is not an element', () => {
    expect(isEditableTarget(window)).toBe(false);
    expect(isEditableTarget(document)).toBe(false);
  });

  it.each(['input', 'select', 'textarea'])('is true for %s', (tagName) => {
    const element = mount(`<${tagName} id="target"></${tagName}>`, '#target');

    expect(isEditableTarget(element)).toBe(true);
  });

  it('is true for an input of any type', () => {
    const element = mount('<input id="target" type="checkbox">', '#target');

    expect(isEditableTarget(element)).toBe(true);
  });

  it.each(['', 'true', 'plaintext-only'])('is true for contenteditable="%s"', (value) => {
    const element = mount(`<div contenteditable="${value}" id="target"></div>`, '#target');

    expect(isEditableTarget(element)).toBe(true);
  });

  it('is true for a child of an editable host', () => {
    const element = mount('<div contenteditable="true"><p><b id="target">text</b></p></div>', '#target');

    expect(isEditableTarget(element)).toBe(true);
  });

  it('is false for contenteditable="false"', () => {
    const element = mount('<div contenteditable="false" id="target"></div>', '#target');

    expect(isEditableTarget(element)).toBe(false);
  });

  it('is false for a button, a link and a plain element', () => {
    mount('<button id="button"></button><a href="#x" id="link">x</a><div id="plain"></div>', '#button');

    expect(isEditableTarget(document.querySelector('#button'))).toBe(false);
    expect(isEditableTarget(document.querySelector('#link'))).toBe(false);
    expect(isEditableTarget(document.querySelector('#plain'))).toBe(false);
    expect(isEditableTarget(document.body)).toBe(false);
  });
});
