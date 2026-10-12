import type { AppSectionValue } from '@/shared/routing';

import { ChunkLoadError } from '@/shared/lib/module-loader';

export class SectionChunkLoadError extends ChunkLoadError {
  readonly section: AppSectionValue;

  constructor(section: AppSectionValue, attempt: number, options?: ErrorOptions) {
    super(attempt, `Section chunk failed to load: ${section}`, options);
    this.name = 'SectionChunkLoadError';
    this.section = section;
  }
}
