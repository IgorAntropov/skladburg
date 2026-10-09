import type { ReactElement } from 'react';

import { User } from 'lucide-react';
import { useState } from 'react';

import { cn } from '@/shared/lib/cn';

import type { AvatarSizeValue } from './avatarStyles';

import {
  AVATAR_BASE_CLASS_NAME,
  AVATAR_ICON_SIZE_CLASS_NAMES,
  AVATAR_IMAGE_SIZE_PX,
  AVATAR_SIZE_CLASS_NAMES,
  AVATAR_TONE_CLASS_NAMES,
} from './avatarStyles';
import { getInitials } from './getInitials';
import { pickAvatarTone } from './pickAvatarTone';

export interface AvatarProps {
  className?: string | undefined;
  imageUrl?: string | undefined;
  name: string;
  seed: string;
  size?: AvatarSizeValue | undefined;
}

export const Avatar = ({ className, imageUrl, name, seed, size = 'md' }: AvatarProps): ReactElement => {
  const [failedImageUrl, setFailedImageUrl] = useState<string | undefined>(undefined);

  const initials = getInitials(name);
  const toneClassName = AVATAR_TONE_CLASS_NAMES[pickAvatarTone(seed, AVATAR_TONE_CLASS_NAMES.length)];
  const isImageShown = imageUrl !== undefined && imageUrl !== '' && imageUrl !== failedImageUrl;
  const isInitialsShown = !isImageShown && initials !== '';
  const isIconShown = !isImageShown && !isInitialsShown;

  const handleImageError = (): void => {
    console.log('> Avatar -> handleImageError:', { imageUrl });
    setFailedImageUrl(imageUrl);
  };

  return (
    <span aria-hidden className={cn(AVATAR_BASE_CLASS_NAME, AVATAR_SIZE_CLASS_NAMES[size], toneClassName, className)}>
      {isImageShown
        ? (
            <img
              alt=""
              className="size-full object-cover"
              decoding="async"
              height={AVATAR_IMAGE_SIZE_PX[size]}
              onError={handleImageError}
              src={imageUrl}
              width={AVATAR_IMAGE_SIZE_PX[size]}
            />
          )
        : null}
      {isInitialsShown ? initials : null}
      {isIconShown ? <User aria-hidden className={AVATAR_ICON_SIZE_CLASS_NAMES[size]} /> : null}
    </span>
  );
};
