export interface DeferredPreloadScriptOptionsValue {
  hrefs: readonly string[];
  triggerSelectors: readonly string[];
}

const toLiteral = (value: unknown): string => JSON.stringify(value).replaceAll('<', '\\u003c');

export const createEntryScriptSelector = (entrySrc: string): string => `script[src=${JSON.stringify(entrySrc)}]`;

export const createLinkSelector = (href: string): string => `link[href=${JSON.stringify(href)}]`;

export const createDeferredPreloadScript = ({ hrefs, triggerSelectors }: DeferredPreloadScriptOptionsValue): string => {
  return [
    '(function(){try{',
    `var d=0,u=${toLiteral(hrefs)},`,
    'g=function(){',
    'if(d){return}',
    'd=1;',
    'for(var i=0,k;i<u.length;i++){',
    'k=document.createElement("link");',
    'k.rel="modulepreload";',
    'k.crossOrigin="";',
    'k.href=u[i];',
    'document.head.appendChild(k)',
    '}',
    '},',
    `s=${toLiteral(triggerSelectors)},i=0,e;`,
    'for(;i<s.length;i++){',
    'e=document.querySelector(s[i]);',
    'if(e){e.addEventListener("load",g);if(e.sheet){g()}}',
    '}',
    '}catch(x){}})()',
  ].join('');
};
