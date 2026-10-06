const lineBreakPattern = /\r?\n/;

export const splitLines = (source: string): string[] => source.split(lineBreakPattern);

export const countLineBreaks = (text: string): number => text.split('\n').length - 1;
