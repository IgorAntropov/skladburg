export type AvatarMediaTypeValue = 'image/jpeg' | 'image/png' | 'image/webp';

export interface EncodedAvatarValue {
  bytes: Uint8Array;
  mediaType: AvatarMediaTypeValue;
}
