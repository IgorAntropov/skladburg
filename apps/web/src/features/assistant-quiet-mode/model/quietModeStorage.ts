export const QUIET_MODE_STORAGE_KEY = 'skladburg.assistant.quiet-mode';

const QUIET_MODE_ON = 'on';

export const readStoredQuietMode = (): boolean => {
  try {
    return window.localStorage.getItem(QUIET_MODE_STORAGE_KEY) === QUIET_MODE_ON;
  }
  catch (error: unknown) {
    console.error('> quietModeStorage -> readStoredQuietMode:', { error });

    return false;
  }
};

export const writeStoredQuietMode = (isQuiet: boolean): void => {
  try {
    if (isQuiet) {
      window.localStorage.setItem(QUIET_MODE_STORAGE_KEY, QUIET_MODE_ON);
    }
    else {
      window.localStorage.removeItem(QUIET_MODE_STORAGE_KEY);
    }
  }
  catch (error: unknown) {
    console.error('> quietModeStorage -> writeStoredQuietMode:', { error });
  }
};
