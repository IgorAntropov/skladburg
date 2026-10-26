import type { ReactElement } from 'react';

import { useState } from 'react';

import type {
  OrganizationLogoBackgroundValue,
  OrganizationLogoValue,
} from '@/entities/organization';

import {
  pickOrganizationLogoPath,
  resolveOrganizationLogoUrl,
} from '@/entities/organization';
import { getAppBaseUrl } from '@/shared/routing';
import { useResolvedTheme } from '@/shared/theme';

interface OrganizationCardLogoProps {
  logo: OrganizationLogoValue | undefined;
}

const LOGO_HEIGHT_PIXELS = 40;

const resolveLogoUrl = (logo: OrganizationLogoValue | undefined, background: OrganizationLogoBackgroundValue): string | undefined => {
  const path = pickOrganizationLogoPath(logo, background);

  return path === undefined ? undefined : resolveOrganizationLogoUrl(path, getAppBaseUrl());
};

export const OrganizationCardLogo = ({ logo }: OrganizationCardLogoProps): null | ReactElement => {
  const resolvedTheme = useResolvedTheme();
  const [failedUrl, setFailedUrl] = useState<string | undefined>(undefined);

  const logoUrl = resolveLogoUrl(logo, resolvedTheme);
  const isLogoShown = logoUrl !== undefined && logoUrl !== failedUrl;

  const handleLogoError = (): void => {
    console.log('> OrganizationCardLogo -> handleLogoError:', { logoUrl });

    setFailedUrl(logoUrl);
  };

  if (!isLogoShown) {
    return null;
  }

  return (
    <div className="flex h-10 items-center">
      <img
        alt=""
        className="block h-10 w-auto max-w-40 object-contain object-left"
        data-testid="organization-card-logo"
        decoding="async"
        draggable={false}
        height={LOGO_HEIGHT_PIXELS}
        onError={handleLogoError}
        src={logoUrl}
      />
    </div>
  );
};
