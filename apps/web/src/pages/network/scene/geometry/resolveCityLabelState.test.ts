import {
  describe,
  expect,
  it,
} from 'vitest';

import { resolveCityLabelState } from './resolveCityLabelState';

const CITY = { hiddenSiteIds: ['hidden', 'hidden-2'], id: 'city' };

const NONE: readonly string[] = [];

describe('resolveCityLabelState', () => {
  it('is calm without hover and selection', () => {
    expect(resolveCityLabelState(CITY, undefined, NONE, NONE)).toEqual({ isHovered: false, isSelected: false });
  });

  it('is hovered by the id of the city', () => {
    expect(resolveCityLabelState(CITY, 'city', NONE, NONE).isHovered).toBe(true);
    expect(resolveCityLabelState(CITY, 'hidden', NONE, NONE).isHovered).toBe(false);
    expect(resolveCityLabelState(CITY, 'site', NONE, NONE).isHovered).toBe(false);
  });

  it('is hovered when a site hidden by an overflow is among the hovered sites, not by a visible one', () => {
    expect(resolveCityLabelState(CITY, undefined, ['visible', 'hidden-2'], NONE).isHovered).toBe(true);
    expect(resolveCityLabelState(CITY, undefined, ['visible', 'city'], NONE).isHovered).toBe(false);
    expect(resolveCityLabelState(CITY, undefined, ['visible'], NONE).isHovered).toBe(false);
  });

  it('is selected by the city and by a site hidden by an overflow, not by a visible site', () => {
    expect(resolveCityLabelState(CITY, undefined, NONE, ['city']).isSelected).toBe(true);
    expect(resolveCityLabelState(CITY, undefined, NONE, ['hidden']).isSelected).toBe(true);
    expect(resolveCityLabelState(CITY, undefined, NONE, ['visible-site']).isSelected).toBe(false);
  });

  it('is selected when any of several selected ids is the city or hidden in it', () => {
    expect(resolveCityLabelState(CITY, undefined, NONE, ['visible-site', 'other', 'hidden-2']).isSelected).toBe(true);
    expect(resolveCityLabelState(CITY, undefined, NONE, ['visible-site', 'other']).isSelected).toBe(false);
  });

  it('can be hovered and selected at once', () => {
    expect(resolveCityLabelState(CITY, 'city', NONE, ['city'])).toEqual({ isHovered: true, isSelected: true });
  });
});
