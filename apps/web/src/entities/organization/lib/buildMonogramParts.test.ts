import {
  describe,
  expect,
  it,
} from 'vitest';

import { buildMonogramParts } from './buildMonogramParts';

describe('buildMonogramParts', () => {
  describe('starting data names', () => {
    it.each([
      ['Заказчик 1', 'Зак', '1'],
      ['Заказчик 2', 'Зак', '2'],
      ['Поставщик 1', 'Пос', '1'],
      ['Поставщик 5', 'Пос', '5'],
      ['Перевозчик 1', 'Пер', '1'],
      ['Перевозчик 2', 'Пер', '2'],
    ])('%s gives %s and %s', (name, letters, index) => {
      expect(buildMonogramParts(name)).toEqual({ index, letters });
    });
  });

  describe('legal forms', () => {
    it.each([
      'ООО «Заказчик 1»',
      'ООО "Заказчик 1"',
      'ооо Заказчик 1',
      'Заказчик 1 ООО',
      'АО «Заказчик 1»',
      'ПАО «Заказчик 1»',
      'ИП Заказчик 1',
      'LLC Заказчик 1',
      'Общество с ограниченной ответственностью «Заказчик 1»',
      'общество  с  ограниченной ответственностью Заказчик 1',
      'Публичное акционерное общество Заказчик 1',
      'Акционерное общество Заказчик 1',
      'Индивидуальный предприниматель Заказчик 1',
    ])('drops the form in %s', (name) => {
      expect(buildMonogramParts(name)).toEqual({ index: '1', letters: 'Зак' });
    });

    it('gives the same parts with and without the form', () => {
      expect(buildMonogramParts('ООО «Заказчик 1»')).toEqual(buildMonogramParts('Заказчик 1'));
    });

    it('returns no monogram for a name made only of legal forms', () => {
      expect(buildMonogramParts('ООО')).toEqual({ index: '', letters: '' });
      expect(buildMonogramParts('ООО АО')).toEqual({ index: '', letters: '' });
      expect(buildMonogramParts('Общество с ограниченной ответственностью')).toEqual({ index: '', letters: '' });
    });
  });

  describe('quotes and word boundaries', () => {
    it('ignores guillemets and straight quotes', () => {
      expect(buildMonogramParts('«Заказчик»')).toEqual({ index: '', letters: 'Зак' });
      expect(buildMonogramParts('"Заказчик"')).toEqual({ index: '', letters: 'Зак' });
    });

    it('treats a hyphen as a word boundary', () => {
      expect(buildMonogramParts('Ростов-Снаб')).toEqual({ index: '', letters: 'РС' });
    });

    it('treats a dot as a word boundary', () => {
      expect(buildMonogramParts('Агро.Снаб')).toEqual({ index: '', letters: 'АС' });
    });
  });

  describe('connectors', () => {
    it.each([
      ['Склад и Логистика', 'СЛ'],
      ['Склад в Лесу', 'СЛ'],
      ['Завод на Волге', 'ЗВ'],
      ['Товары для Дома', 'ТД'],
      ['Доставка от Двери', 'ДД'],
      ['Доставка по Городу', 'ДГ'],
    ])('skips the connector in %s', (name, letters) => {
      expect(buildMonogramParts(name)).toEqual({ index: '', letters });
    });

    it('does not take letters from a connector between two words', () => {
      expect(buildMonogramParts('Мир и Дом 3')).toEqual({ index: '3', letters: 'МД' });
    });

    it('keeps a name made only of connectors', () => {
      expect(buildMonogramParts('и в на')).toEqual({ index: '', letters: 'ИВ' });
      expect(buildMonogramParts('для')).toEqual({ index: '', letters: 'Для' });
    });
  });

  describe('letters', () => {
    it('takes three letters of a single word with a capital first one', () => {
      expect(buildMonogramParts('поставщик')).toEqual({ index: '', letters: 'Пос' });
      expect(buildMonogramParts('ПОСТАВЩИК')).toEqual({ index: '', letters: 'Пос' });
    });

    it('takes as many letters as there are in a short single word', () => {
      expect(buildMonogramParts('Ян')).toEqual({ index: '', letters: 'Ян' });
      expect(buildMonogramParts('Я')).toEqual({ index: '', letters: 'Я' });
    });

    it('takes two capitals from two words', () => {
      expect(buildMonogramParts('Свежие продукты')).toEqual({ index: '', letters: 'СП' });
    });

    it('takes only the first two of several words', () => {
      expect(buildMonogramParts('Северный Строительный Альянс')).toEqual({ index: '', letters: 'СС' });
    });

    it('handles latin names', () => {
      expect(buildMonogramParts('Fresh')).toEqual({ index: '', letters: 'Fre' });
      expect(buildMonogramParts('Fresh Foods 7')).toEqual({ index: '7', letters: 'FF' });
    });

    it('keeps the letter yo', () => {
      expect(buildMonogramParts('ёлка')).toEqual({ index: '', letters: 'Ёлк' });
      expect(buildMonogramParts('Ёлка Ёж')).toEqual({ index: '', letters: 'ЁЁ' });
      expect(buildMonogramParts('ЁЛКА')).toEqual({ index: '', letters: 'Ёлк' });
    });
  });

  describe('index', () => {
    it('takes the first digits-only word and keeps it out of the letters', () => {
      expect(buildMonogramParts('Склад 12 Север')).toEqual({ index: '12', letters: 'СС' });
    });

    it('keeps an index of any length whole', () => {
      expect(buildMonogramParts('Заказчик 123456')).toEqual({ index: '123456', letters: 'Зак' });
    });

    it('takes the first of several digit words', () => {
      expect(buildMonogramParts('Заказчик 4 5')).toEqual({ index: '4', letters: 'Зак' });
    });

    it('returns only the index for a name made of digits', () => {
      expect(buildMonogramParts('42')).toEqual({ index: '42', letters: '' });
      expect(buildMonogramParts('ООО «777»')).toEqual({ index: '777', letters: '' });
    });

    it('does not treat a word of a letter and digits as the index', () => {
      expect(buildMonogramParts('1С Склад')).toEqual({ index: '', letters: 'СС' });
    });
  });

  describe('empty names', () => {
    it.each([
      '',
      '   ',
      '«»',
      '---',
    ])('returns no monogram for "%s"', (name) => {
      expect(buildMonogramParts(name)).toEqual({ index: '', letters: '' });
    });
  });
});
