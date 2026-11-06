export class SeedLoadError extends Error {
  constructor(cause: unknown) {
    super('The seed module could not be loaded', { cause });
    this.name = 'SeedLoadError';
  }
}

export const isSeedLoadError = (error: unknown): error is SeedLoadError => error instanceof SeedLoadError;
