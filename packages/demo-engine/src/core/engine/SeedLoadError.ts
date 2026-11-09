export class SeedLoadError extends Error {
  constructor(cause: unknown, message = 'The seed module could not be loaded') {
    super(message, { cause });
    this.name = 'SeedLoadError';
  }
}

export const isSeedLoadError = (error: unknown): error is SeedLoadError => error instanceof SeedLoadError;
