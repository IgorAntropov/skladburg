import { useEffect } from 'react';

import { useNavigate } from '@/shared/routing';

import { DEFAULT_SECTION } from './sections';

export const HomeRedirect = (): null => {
  const navigate = useNavigate();

  useEffect(() => {
    navigate({ kind: 'section', section: DEFAULT_SECTION }, { isReplace: true });
  }, [navigate]);

  return null;
};
