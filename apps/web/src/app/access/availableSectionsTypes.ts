import type { AppSectionValue } from '@/shared/routing';

export type AvailableSectionsValue
  = | { error: Error; isRetrying: boolean; kind: 'error'; onRetry: () => void }
    | { kind: 'empty' }
    | { kind: 'loading' }
    | { kind: 'ready'; landingSection: AppSectionValue; sections: readonly AppSectionValue[] };
