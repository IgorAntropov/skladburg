import { APP_BASE_PATH } from '../build-base/appBasePath.ts';

export type PerfPreviewProtocolValue = 'h1' | 'h2';

export const PERF_PREVIEW_PORT = '4175';

export const PERF_PREVIEW_CACHE_CONTROL = 'max-age=600';

export const PERF_PREVIEW_CACHE_CONTROL_ENV_NAME = 'PERF_PREVIEW_CACHE_CONTROL';

export const PERF_PREVIEW_PROTOCOL_ENV_NAME = 'PERF_PREVIEW_PROTOCOL';

export const DEFAULT_PERF_PREVIEW_PROTOCOL: PerfPreviewProtocolValue = 'h2';

const HTTP2_PROTOCOL = 'h2';

export const readPreviewProtocol = (env: Readonly<Record<string, string | undefined>>): PerfPreviewProtocolValue => {
  const text = env[PERF_PREVIEW_PROTOCOL_ENV_NAME]?.trim().toLowerCase();

  if (text === undefined || text === '') {
    return DEFAULT_PERF_PREVIEW_PROTOCOL;
  }

  if (text === 'h1' || text === 'h2') {
    return text;
  }

  throw new Error(`${PERF_PREVIEW_PROTOCOL_ENV_NAME} must be "h1" or "h2", got "${text}"`);
};

export const createPreviewUrl = (protocol: PerfPreviewProtocolValue): string => {
  const scheme = protocol === 'h2' ? 'https' : 'http';

  return `${scheme}://localhost:${PERF_PREVIEW_PORT}${APP_BASE_PATH}`;
};

export const assertDocumentProtocol = (
  previewProtocol: PerfPreviewProtocolValue,
  documentProtocol: string | undefined,
): void => {
  if (previewProtocol === 'h2' && documentProtocol !== HTTP2_PROTOCOL) {
    throw new Error(
      `${PERF_PREVIEW_PROTOCOL_ENV_NAME}=h2 needs the document over "${HTTP2_PROTOCOL}", `
      + `the preview answered "${String(documentProtocol)}"; set ${PERF_PREVIEW_PROTOCOL_ENV_NAME}=h1 to measure over HTTP/1.1`,
    );
  }
};
