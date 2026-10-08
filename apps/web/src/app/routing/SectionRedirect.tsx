import { useEffect } from 'react';

import type { AppSectionValue } from '@/shared/routing';

import { useNavigate } from '@/shared/routing';

interface SectionRedirectProps {
  section: AppSectionValue;
}

export const SectionRedirect = ({ section }: SectionRedirectProps): null => {
  const navigate = useNavigate();

  useEffect(() => {
    navigate({ kind: 'section', section }, { isReplace: true });
  }, [navigate, section]);

  return null;
};
