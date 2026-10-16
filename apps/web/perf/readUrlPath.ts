const FALLBACK_ORIGIN = 'http://localhost';

export const readPathname = (url: string): string => {
  try {
    return new URL(url, FALLBACK_ORIGIN).pathname;
  }
  catch {
    return url;
  }
};

export const readLastSegment = (url: string): string => (
  readPathname(url).split('/').filter(segment => segment !== '').pop() ?? url
);
