const ALLOWED_LOGO_PROTOCOLS: ReadonlySet<string> = new Set(['http:', 'https:']);

const DATA_IMAGE_PATH_PREFIX = 'image/';

export const resolveOrganizationLogoUrl = (path: string, baseUrl: string | URL): string | undefined => {
  if (path.trim() === '') {
    return undefined;
  }

  try {
    const url = new URL(path, baseUrl);
    const isDataImage = url.protocol === 'data:' && url.pathname.toLowerCase().startsWith(DATA_IMAGE_PATH_PREFIX);

    return ALLOWED_LOGO_PROTOCOLS.has(url.protocol) || isDataImage ? url.href : undefined;
  }
  catch {
    return undefined;
  }
};
