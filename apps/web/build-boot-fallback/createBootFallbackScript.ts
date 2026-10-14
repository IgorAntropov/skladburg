import type { BootFallbackScriptOptionsValue } from './bootFallbackTypes.ts';

export const BOOT_BAR_SELECTOR = '.boot-bar';

export const RELOAD_BUTTON_SELECTOR = 'button';

const toLiteral = (value: string): string => JSON.stringify(value).replaceAll('<', '\\u003c');

export const createBootFallbackScript = ({ elementId, rootId }: BootFallbackScriptOptionsValue): string => {
  return [
    '(function(){',
    'var d=0;',
    'addEventListener("error",function(e){',
    'try{',
    'if(d){return}',
    `var b=document.getElementById(${toLiteral(elementId)});`,
    'if(!b){return}',
    'var t=e.target,n=t&&t.tagName;',
    'if(n==="LINK"){',
    'if(t.rel!=="stylesheet"&&t.rel!=="modulepreload"){return}',
    '}else if(n&&n!=="SCRIPT"){return}',
    'd=1;',
    'b.setAttribute("role","alert");',
    'b.hidden=false;',
    `var r=document.getElementById(${toLiteral(rootId)}),a=r&&r.querySelector(${toLiteral(BOOT_BAR_SELECTOR)});`,
    'if(a){a.hidden=true}',
    `var u=b.querySelector(${toLiteral(RELOAD_BUTTON_SELECTOR)});`,
    'if(u){u.addEventListener("click",function(){location.reload()})}',
    '}catch(x){}',
    '},true)',
    '})()',
  ].join('');
};
