import { createContext } from 'react';

import type { CatalogEditorTranslate } from '../i18n/editor/editorSection';

export const EditorTextsContext = createContext<CatalogEditorTranslate | undefined>(undefined);
