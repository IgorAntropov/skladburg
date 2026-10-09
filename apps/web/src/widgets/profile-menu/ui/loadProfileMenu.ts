type ProfileMenuModuleValue = typeof import('./menu/ProfileMenu');

export const loadProfileMenu = (): Promise<ProfileMenuModuleValue> => import('./menu/ProfileMenu');
