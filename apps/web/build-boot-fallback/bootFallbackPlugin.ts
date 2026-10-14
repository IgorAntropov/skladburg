import type { Plugin } from 'vite';

import type { BootFallbackMessagesValue } from './bootFallbackTypes.ts';

import { BOOT_FALLBACK_ELEMENT_ID } from '../src/app/bootstrap/bootFallbackConstants.ts';
import { applyBootFallbackToHtml } from './applyBootFallbackToHtml.ts';
import { createBootFallbackStyle } from './bootFallbackStyle.ts';
import { createBootFallbackMarkup } from './createBootFallbackMarkup.ts';
import { createBootFallbackScript } from './createBootFallbackScript.ts';

const ROOT_ELEMENT_ID = 'root';

export interface BootFallbackPluginOptionsValue {
  messages: BootFallbackMessagesValue;
}

export type BootFallbackPluginValue = Omit<Plugin, 'transformIndexHtml'> & {
  transformIndexHtml: { handler: (html: string) => string; order: 'pre' };
};

export const bootFallbackPlugin = ({ messages }: BootFallbackPluginOptionsValue): BootFallbackPluginValue => {
  const parts = {
    markup: createBootFallbackMarkup({ elementId: BOOT_FALLBACK_ELEMENT_ID, messages }),
    script: createBootFallbackScript({ elementId: BOOT_FALLBACK_ELEMENT_ID, rootId: ROOT_ELEMENT_ID }),
    style: createBootFallbackStyle(BOOT_FALLBACK_ELEMENT_ID),
  };

  return {
    apply: 'build',
    name: 'skladburg:boot-fallback',
    transformIndexHtml: {
      handler: html => applyBootFallbackToHtml(html, parts),
      order: 'pre',
    },
  };
};
