import type { ReactElement } from 'react';

import type { AppSectionValue } from '@/shared/routing';

import { useAddress } from '@/shared/routing';

import type {
  CachedSectionLoadersValue,
  SectionPagesValue,
} from './sectionPages';

import { LandingLinkScreen } from './LandingLinkScreen';
import { resolveRoute } from './resolveRoute';
import { RouteFrame } from './RouteFrame';
import { SectionPreloader } from './SectionPreloader';
import { SectionRedirect } from './SectionRedirect';

interface ReadyRoutesProps {
  cachedLoaders: CachedSectionLoadersValue;
  landingSection: AppSectionValue;
  sectionPages: SectionPagesValue;
  sections: readonly AppSectionValue[];
}

export const ReadyRoutes = ({
  cachedLoaders,
  landingSection,
  sectionPages,
  sections,
}: ReadyRoutesProps): ReactElement => {
  const { address, path } = useAddress();

  const route = resolveRoute(address, sections);

  if (route.kind === 'redirect') {
    return <SectionRedirect section={landingSection} />;
  }

  let screen: ReactElement;
  const section = route.kind === 'page' ? route.section : undefined;
  if (route.kind === 'page') {
    const Page = sectionPages[route.section];
    screen = <Page focus={route.focus} />;
  }
  else {
    screen = <LandingLinkScreen kind={route.kind === 'not-found' ? 'notFound' : 'objectUnavailable'} landingSection={landingSection} />;
  }

  return (
    <>
      <RouteFrame errorResetKey={section ?? route.kind} path={path} shouldPreserveScroll={section === 'deals'}>
        {screen}
      </RouteFrame>
      <SectionPreloader loaders={cachedLoaders} section={section} sections={sections} />
    </>
  );
};
