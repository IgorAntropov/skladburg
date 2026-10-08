import { renderHook } from '@testing-library/react';
import {
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { AvailableSectionsProvider } from './AvailableSectionsProvider';
import { useAvailableSections } from './useAvailableSections';

describe('useAvailableSections', () => {
  it('returns the value of the provider', () => {
    const value = { kind: 'ready', landingSection: 'deals', sections: ['deals'] } as const;

    const { result } = renderHook(useAvailableSections, {
      wrapper: ({ children }) => <AvailableSectionsProvider value={value}>{children}</AvailableSectionsProvider>,
    });

    expect(result.current).toBe(value);
  });

  it('throws outside the provider', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    expect(() => renderHook(useAvailableSections)).toThrow('AvailableSectionsProvider');
  });
});
