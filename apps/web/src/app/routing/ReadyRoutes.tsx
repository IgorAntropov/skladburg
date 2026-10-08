import type { ReactElement } from 'react';

import type { AppSectionValue } from '@/shared/routing';

import { useAddress } from '@/shared/routing';

import type {
  CachedSectionLoadersValue,
  SectionPagesValue,
} from './sectionPages';

import { NotFoundScreen } from './NotFoundScreen';
import { ObjectUnavailableScreen } from './ObjectUnavailableScreen';
import { resolveRoute } from './resolveRoute';
import { RouteFrame } from './RouteFrame';
import { SectionPreloader } from './SectionPreloader';
import { SectionRedirect } from './SectionRedirect';

const NOT_FOUND_RESET_KEY = 'not-found';
const OBJECT_UNAVAILABLE_RESET_KEY = 'object-unavailable';

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

  if (route.kind === 'page') {
    const Page = sectionPages[route.section];

    return (
      <>
        <RouteFrame errorResetKey={route.section} path={path}>
          <Page focus={route.focus} />
        </RouteFrame>
        <SectionPreloader loaders={cachedLoaders} section={route.section} sections={sections} />
      </>
    );
  }

  const isObjectUnavailable = route.kind === 'object-unavailable';
  const errorResetKey = isObjectUnavailable ? OBJECT_UNAVAILABLE_RESET_KEY : NOT_FOUND_RESET_KEY;
  const screen = isObjectUnavailable
    ? <ObjectUnavailableScreen landingSection={landingSection} />
    : <NotFoundScreen landingSection={landingSection} />;

  return (
    <>
      <RouteFrame errorResetKey={errorResetKey} path={path}>
        {screen}
      </RouteFrame>
      <SectionPreloader loaders={cachedLoaders} section={undefined} sections={sections} />
    </>
  );
};
