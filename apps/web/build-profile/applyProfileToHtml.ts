import type { BuildProfileValue } from './buildProfileTypes.ts';

export const APP_NAME_PLACEHOLDER = '%PROFILE_APP_NAME%';

export const LANG_PLACEHOLDER = '%PROFILE_LANG%';

export const TITLE_PLACEHOLDER = '%PROFILE_TITLE%';

const HTML_ESCAPES: Readonly<Record<string, string>> = {
  '"': '&quot;',
  '&': '&amp;',
  '\'': '&#39;',
  '<': '&lt;',
  '>': '&gt;',
};

const escapeHtml = (text: string): string => {
  return text.replace(/["&'<>]/g, character => HTML_ESCAPES[character] ?? character);
};

const replacePlaceholder = (html: string, placeholder: string, value: string): string => {
  if (!html.includes(placeholder)) {
    throw new Error(`index.html must contain the ${placeholder} placeholder`);
  }

  return html.replaceAll(placeholder, escapeHtml(value));
};

export const applyProfileToHtml = (html: string, { defaultTenant }: BuildProfileValue, appName: string): string => {
  const htmlWithLang = replacePlaceholder(html, LANG_PLACEHOLDER, defaultTenant.defaultLocale);
  const htmlWithTitle = replacePlaceholder(htmlWithLang, TITLE_PLACEHOLDER, defaultTenant.brandName);

  return replacePlaceholder(htmlWithTitle, APP_NAME_PLACEHOLDER, appName);
};
