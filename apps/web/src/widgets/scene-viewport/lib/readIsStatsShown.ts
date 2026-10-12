const STATS_QUERY_PARAMETER = 'perf';

export const readIsStatsShown = (searchParams: URLSearchParams, isDevelopmentBuild: boolean): boolean => {
  return isDevelopmentBuild && searchParams.has(STATS_QUERY_PARAMETER);
};
