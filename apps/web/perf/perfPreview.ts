import { APP_BASE_PATH } from '../build-base/appBasePath.ts';

export const PERF_PREVIEW_PORT = '4175';

export const PERF_PREVIEW_URL = `http://localhost:${PERF_PREVIEW_PORT}${APP_BASE_PATH}`;

export const PERF_PREVIEW_CACHE_CONTROL = 'max-age=600';

export const PERF_PREVIEW_CACHE_CONTROL_ENV_NAME = 'PERF_PREVIEW_CACHE_CONTROL';
