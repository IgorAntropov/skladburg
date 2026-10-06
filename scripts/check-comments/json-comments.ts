const byteOrderMark = '\uFEFF';
const jsonErrorLinePattern = /line (\d+)/;

export const findInvalidJsonLines = (source: string): number[] => {
  try {
    JSON.parse(source.startsWith(byteOrderMark) ? source.slice(byteOrderMark.length) : source);
    return [];
  }
  catch (error) {
    const errorLineMatch = error instanceof Error ? jsonErrorLinePattern.exec(error.message) : null;

    return [Number(errorLineMatch?.[1] ?? 1)];
  }
};
