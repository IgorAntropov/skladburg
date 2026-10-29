type SupportChatModuleValue = typeof import('./chat/SupportChat');

export const loadSupportChat = (): Promise<SupportChatModuleValue> => import('./chat/SupportChat');
