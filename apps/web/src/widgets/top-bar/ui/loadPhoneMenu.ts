type PhoneMenuModuleValue = typeof import('./PhoneMenu');

export const loadPhoneMenu = (): Promise<PhoneMenuModuleValue> => import('./PhoneMenu');
