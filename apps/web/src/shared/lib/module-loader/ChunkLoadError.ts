export class ChunkLoadError extends Error {
  readonly attempt: number;

  constructor(attempt: number, message = 'Chunk failed to load', options?: ErrorOptions) {
    super(message, options);
    this.name = 'ChunkLoadError';
    this.attempt = attempt;
  }
}
