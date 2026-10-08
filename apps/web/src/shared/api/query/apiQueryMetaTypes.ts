export interface ApiQueryMetaValue extends Record<string, unknown> {
  channels?: readonly string[];
}

declare module '@tanstack/react-query' {
  interface Register {
    queryMeta: ApiQueryMetaValue;
  }
}
