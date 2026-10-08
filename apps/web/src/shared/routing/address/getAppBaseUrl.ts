export const getAppBaseUrl = (): URL => {
  return new URL(import.meta.env.BASE_URL, window.location.origin);
};
