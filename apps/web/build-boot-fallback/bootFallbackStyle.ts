import type {
  BootFallbackColorsValue,
  BootFallbackThemeColorsValue,
} from './bootFallbackTypes.ts';

export const BOOT_FALLBACK_COLORS: BootFallbackThemeColorsValue = {
  dark: {
    background: '#121a30',
    badge: '#e5484d',
    badgeIcon: '#0b1226',
    button: '#3b5bdb',
    buttonText: '#ffffff',
    focus: '#e3e9ff',
    text: '#e8e4dc',
  },
  light: {
    background: '#edeae3',
    badge: '#e5484d',
    badgeIcon: '#0b1226',
    button: '#3b5bdb',
    buttonText: '#ffffff',
    focus: '#0f1730',
    text: '#1e2a4a',
  },
};

const SYSTEM_FONT = 'system-ui,-apple-system,"Segoe UI",Roboto,sans-serif';

const SAFE_PADDING = ['top', 'right', 'bottom', 'left']
  .map(side => `max(1rem,env(safe-area-inset-${side}))`)
  .join(' ');

const createBadgeIcon = (badgeIconColor: string): string => {
  const stroke = encodeURIComponent(badgeIconColor);

  return [
    `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' `,
    `stroke='${stroke}' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E`,
    `%3Cpath d='m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3M12 9v4M12 17h.01'/%3E%3C/svg%3E")`,
  ].join('');
};

const createColorRule = (
  selector: string,
  colors: BootFallbackColorsValue,
): string => {
  return [
    `${selector}{background:${colors.background};color:${colors.text}}`,
    `${selector} button{background:${colors.button};color:${colors.buttonText}}`,
    `${selector} button:focus-visible{outline:2px solid ${colors.focus};outline-offset:2px}`,
  ].join('');
};

export const createBootFallbackStyle = (elementId: string): string => {
  const selector = `#${elementId}`;

  return [
    `${selector}:not([hidden]){display:flex}`,
    `${selector}{position:fixed;inset:0;z-index:2147483647;box-sizing:border-box;`,
    'flex-direction:column;align-items:center;justify-content:center;gap:1rem;overflow:auto;',
    `padding:${SAFE_PADDING};font:1rem/1.5 ${SYSTEM_FONT};text-align:center}`,
    `${selector}::before{content:"";flex:none;width:3rem;height:3rem;border-radius:50%;`,
    `background:${BOOT_FALLBACK_COLORS.light.badge} ${createBadgeIcon(BOOT_FALLBACK_COLORS.light.badgeIcon)} center/1.5rem no-repeat}`,
    `${selector} p{max-width:32rem;margin:0;font-size:1.5rem;line-height:2rem;font-weight:600;`,
    'letter-spacing:-.025em;text-wrap:balance}',
    `${selector} button{min-height:3rem;padding:0 1.5rem;border:0;border-radius:.5rem;`,
    'font:inherit;font-weight:500;cursor:pointer;touch-action:manipulation;',
    '-webkit-tap-highlight-color:transparent}',
    `@media(hover:hover){${selector} button:hover{filter:brightness(.9)}}`,
    `${selector} button:active{filter:brightness(.75)}`,
    createColorRule(selector, BOOT_FALLBACK_COLORS.light),
    createColorRule(`[data-theme="dark"] ${selector}`, BOOT_FALLBACK_COLORS.dark),
  ].join('');
};
