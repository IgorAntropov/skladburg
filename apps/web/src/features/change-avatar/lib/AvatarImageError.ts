export type AvatarImageErrorKeyValue = 'avatar.decodeFailed' | 'avatar.sourceTooLarge' | 'avatar.tooLarge';

export class AvatarImageError extends Error {
  readonly messageKey: AvatarImageErrorKeyValue;

  constructor(messageKey: AvatarImageErrorKeyValue) {
    super(messageKey);
    this.name = 'AvatarImageError';
    this.messageKey = messageKey;
  }
}
