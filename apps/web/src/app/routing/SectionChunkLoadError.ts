import type { AppSectionValue } from '@/shared/routing';

export class SectionChunkLoadError extends Error {
  readonly section: AppSectionValue;

  constructor(section: AppSectionValue, options?: ErrorOptions) {
    super(`Section chunk failed to load: ${section}`, options);
    this.name = 'SectionChunkLoadError';
    this.section = section;
  }
}
