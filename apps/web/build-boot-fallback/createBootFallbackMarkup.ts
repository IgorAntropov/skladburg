import type { BootFallbackMarkupOptionsValue } from './bootFallbackTypes.ts';

import { escapeHtml } from '../build-profile/applyProfileToHtml.ts';

export const createBootFallbackMarkup = ({ elementId, messages }: BootFallbackMarkupOptionsValue): string => {
  return [
    `<div id="${escapeHtml(elementId)}" hidden data-testid="boot-fallback">`,
    `<p>${escapeHtml(messages.message)}</p>`,
    `<button type="button" data-testid="boot-fallback-reload">${escapeHtml(messages.reload)}</button>`,
    '</div>',
  ].join('');
};
