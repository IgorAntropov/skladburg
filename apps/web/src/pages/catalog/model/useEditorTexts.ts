import { use } from 'react';

import type { CatalogEditorTranslate } from '../i18n/editor/editorSection';

import { EditorTextsContext } from './editorTextsContext';

export const useEditorTexts = (): CatalogEditorTranslate => {
  const texts = use(EditorTextsContext);

  if (texts === undefined) {
    throw new Error('useEditorTexts must be used inside EditorTextsGate');
  }

  return texts;
};
