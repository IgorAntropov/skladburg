export type ViewportClassValue = 'desktop' | 'phone' | 'tablet';

export const VIEWPORT_MEDIA_QUERIES = {
  desktop: '(min-width: 80rem)',
  tablet: '(min-width: 40rem)',
} as const;
