const CHARSET_META_PATTERN = /<meta\s+charset\s*=[^>]*>/i;

const BODY_END_PATTERN = /<\/body\s*>/i;

export interface BootFallbackPartsValue {
  markup: string;
  script: string;
  style: string;
}

export const applyBootFallbackToHtml = (html: string, { markup, script, style }: BootFallbackPartsValue): string => {
  const charsetMatch = CHARSET_META_PATTERN.exec(html);

  if (charsetMatch === null) {
    throw new Error('index.html must contain the <meta charset> tag so the boot fallback can follow it');
  }

  const bodyEndMatch = BODY_END_PATTERN.exec(html);

  if (bodyEndMatch === null) {
    throw new Error('index.html must contain the closing </body> tag so the boot fallback block can precede it');
  }

  const charsetEnd = charsetMatch.index + charsetMatch[0].length;

  return [
    html.slice(0, charsetEnd),
    `<style>${style}</style><script>${script}</script>`,
    html.slice(charsetEnd, bodyEndMatch.index),
    markup,
    html.slice(bodyEndMatch.index),
  ].join('');
};
