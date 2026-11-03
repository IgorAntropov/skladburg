import { useLayoutEffect } from 'react';

export const useReportedTitle = (title: string | undefined, onTitleChange: (title: string | undefined) => void): void => {
  useLayoutEffect(() => {
    onTitleChange(title);

    return () => {
      onTitleChange(undefined);
    };
  }, [onTitleChange, title]);
};
