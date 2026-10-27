type AssistantHostModuleValue = typeof import('./host/AssistantHost');

export const loadAssistantHost = (): Promise<AssistantHostModuleValue> => import('./host/AssistantHost');
