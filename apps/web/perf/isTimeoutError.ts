export const isTimeoutError = (error: unknown): boolean => error instanceof Error && error.name === 'TimeoutError';
