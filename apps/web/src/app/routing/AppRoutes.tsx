import type { ReactElement } from 'react';

import { useState } from 'react';

import { useAddress } from '@/shared/routing';

import type { SectionLoadersValue } from './sectionPages';

import { createCachedSectionLoaders } from './createCachedSectionLoaders';
import { HomeRedirect } from './HomeRedirect';
import { NotFoundScreen } from './NotFoundScreen';
import { RouteFrame } from './RouteFrame';
import { createSectionPages } from './sectionPages';
import { SectionPreloader } from './SectionPreloader';
import { getPlacedAddressSection } from './sections';

const NOT_FOUND_RESET_KEY = 'not-found';

interface AppRoutesProps {
  sectionLoaders: SectionLoadersValue;
}

export const AppRoutes = ({ sectionLoaders }: AppRoutesProps): ReactElement => {
  const { address, path } = useAddress();

  const [cachedLoaders] = useState(() => createCachedSectionLoaders(sectionLoaders));
  const [sectionPages] = useState(() => createSectionPages(cachedLoaders));

  if (address === undefined) {
    return (
      <>
        <RouteFrame errorResetKey={NOT_FOUND_RESET_KEY} path={path}>
          <NotFoundScreen />
        </RouteFrame>
        <SectionPreloader loaders={cachedLoaders} section={undefined} />
      </>
    );
  }

  if (address.kind === 'home') {
    return <HomeRedirect />;
  }

  const section = getPlacedAddressSection(address);
  const focus = address.kind === 'object' ? address.object : undefined;
  const Page = sectionPages[section];

  return (
    <>
      <RouteFrame errorResetKey={section} path={path}>
        <Page focus={focus} />
      </RouteFrame>
      <SectionPreloader loaders={cachedLoaders} section={section} />
    </>
  );
};
