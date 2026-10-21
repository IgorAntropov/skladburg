import {
  describe,
  expect,
  it,
} from 'vitest';

import { resolveCityLabelState } from './resolveCityLabelState';

const CITY = { hiddenSiteIds: ['hidden'], id: 'city' };

describe('resolveCityLabelState', () => {
  it('is calm without hover and selection', () => {
    expect(resolveCityLabelState(CITY, undefined, undefined)).toEqual({ isHovered: false, isSelected: false });
  });

  it('is hovered only by the id of the city', () => {
    expect(resolveCityLabelState(CITY, 'city', undefined).isHovered).toBe(true);
    expect(resolveCityLabelState(CITY, 'hidden', undefined).isHovered).toBe(false);
    expect(resolveCityLabelState(CITY, 'site', undefined).isHovered).toBe(false);
  });

  it('is selected by the city and by a site hidden by an overflow, not by a visible site', () => {
    expect(resolveCityLabelState(CITY, undefined, 'city').isSelected).toBe(true);
    expect(resolveCityLabelState(CITY, undefined, 'hidden').isSelected).toBe(true);
    expect(resolveCityLabelState(CITY, undefined, 'visible-site').isSelected).toBe(false);
  });

  it('can be hovered and selected at once', () => {
    expect(resolveCityLabelState(CITY, 'city', 'city')).toEqual({ isHovered: true, isSelected: true });
  });
});
