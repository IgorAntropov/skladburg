export const DIGEST_MARKS_STORAGE_KEY = 'skladburg.assistant.digest-told';

export const createDigestMark = (userId: string, organizationId: string): string => `${userId}:${organizationId}`;

const readMarks = (storage: Storage): string[] => {
  try {
    const raw = storage.getItem(DIGEST_MARKS_STORAGE_KEY);
    const parsed: unknown = raw === null ? [] : JSON.parse(raw);

    return Array.isArray(parsed) ? parsed.filter((mark): mark is string => typeof mark === 'string') : [];
  }
  catch (error: unknown) {
    console.log('> digestMarks -> readMarks:', { error });

    return [];
  }
};

export const hasDigestMark = (storage: Storage | undefined, mark: string): boolean => {
  return storage !== undefined && readMarks(storage).includes(mark);
};

export const addDigestMark = (storage: Storage | undefined, mark: string): void => {
  if (storage === undefined) {
    return;
  }

  try {
    storage.setItem(DIGEST_MARKS_STORAGE_KEY, JSON.stringify([...new Set([...readMarks(storage), mark])]));
  }
  catch (error: unknown) {
    console.log('> digestMarks -> addDigestMark:', { error, mark });
  }
};

export const clearDigestMarks = (storage: Storage | undefined): void => {
  if (storage === undefined) {
    return;
  }

  try {
    storage.removeItem(DIGEST_MARKS_STORAGE_KEY);
  }
  catch (error: unknown) {
    console.log('> digestMarks -> clearDigestMarks:', { error });
  }
};
