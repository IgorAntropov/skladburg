export interface PathAndQueryValue {
  path: string;
  query: string;
}

export const splitPathAndQuery = (raw: string): PathAndQueryValue => {
  const queryIndex = raw.indexOf('?');

  if (queryIndex === -1) {
    return { path: raw, query: '' };
  }

  return { path: raw.slice(0, queryIndex), query: raw.slice(queryIndex + 1) };
};
