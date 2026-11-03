type SearchPanelEntryModuleValue = typeof import('./panel/searchPanelEntry');

export const loadSearchPanel = (): Promise<SearchPanelEntryModuleValue> => import('./panel/searchPanelEntry');
