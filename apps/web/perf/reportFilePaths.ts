const MARKDOWN_EXTENSION = /\.md$/;

export const resolveJsonReportPath = (markdownPath: string): string => (
  markdownPath.endsWith('.md') ? markdownPath.replace(MARKDOWN_EXTENSION, '.json') : `${markdownPath}.json`
);
