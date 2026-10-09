export type AvatarSizeValue = 'lg' | 'md' | 'sm';

export const AVATAR_BASE_CLASS_NAME
  = 'inline-flex shrink-0 select-none items-center justify-center overflow-hidden rounded-full font-semibold leading-none';

export const AVATAR_SIZE_CLASS_NAMES = {
  lg: 'size-16 text-2xl',
  md: 'size-9 text-sm',
  sm: 'size-8 text-xs',
} as const satisfies Record<AvatarSizeValue, string>;

export const AVATAR_ICON_SIZE_CLASS_NAMES = {
  lg: 'size-8',
  md: 'size-5',
  sm: 'size-4',
} as const satisfies Record<AvatarSizeValue, string>;

export const AVATAR_IMAGE_SIZE_PX = {
  lg: 64,
  md: 36,
  sm: 32,
} as const satisfies Record<AvatarSizeValue, number>;

export const AVATAR_TONE_CLASS_NAMES: readonly string[] = [
  'bg-avatar-1 text-on-avatar-1',
  'bg-avatar-2 text-on-avatar-2',
  'bg-avatar-3 text-on-avatar-3',
  'bg-avatar-4 text-on-avatar-4',
  'bg-avatar-5 text-on-avatar-5',
  'bg-avatar-6 text-on-avatar-6',
  'bg-avatar-7 text-on-avatar-7',
  'bg-avatar-8 text-on-avatar-8',
];
