import type { ThemeBootScriptOptionsValue } from './themeBootScriptTypes.ts';

const escapeForInlineScript = (json: string): string => json.replaceAll('<', '\\u003c');

const toLiteral = (value: string): string => escapeForInlineScript(JSON.stringify(value));

export const createThemeBootScript = ({
  darkQuery,
  defaultPreference,
  storageKey,
  themeColors,
}: ThemeBootScriptOptionsValue): string => {
  return [
    '(function(){',
    `var p=${toLiteral(defaultPreference)};`,
    'try{',
    `var s=localStorage.getItem(${toLiteral(storageKey)});`,
    'if(s==="light"||s==="dark"||s==="system"){p=s}',
    '}catch(e){}',
    'var t=p;',
    'if(p==="system"){',
    'try{',
    `t=matchMedia(${toLiteral(darkQuery)}).matches?"dark":"light"`,
    '}catch(e){t="light"}',
    '}',
    'var r=document.documentElement;',
    'r.dataset.theme=t;',
    'r.style.colorScheme=t;',
    `var c=${escapeForInlineScript(JSON.stringify(themeColors))};`,
    'try{',
    'var m=document.querySelector(\'meta[name="theme-color"]\');',
    'if(m&&c[t]){m.content=c[t]}',
    '}catch(e){}',
    '})()',
  ].join('');
};
