import type { ConnectRouter } from '@connectrpc/connect';
import type { GetSessionResponse } from '@skladburg/contracts/access/v1/access';
import type {
  ReactElement,
  ReactNode,
} from 'react';

import { create } from '@bufbuild/protobuf';
import {
  Code,
  ConnectError,
} from '@connectrpc/connect';
import {
  AccessService,
  GetSessionResponseSchema,
} from '@skladburg/contracts/access/v1/access';
import {
  OrganizationProfileSchema,
  OrganizationSchema,
  ProfileKind,
} from '@skladburg/contracts/organization/v1/organization';
import {
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query';
import { useState } from 'react';
import { defaultLocaleCatalog } from 'virtual:build-profile';
import { vi } from 'vitest';

import type {
  ApiRuntimeValue,
  DemoPersonaListItemValue,
  IDemoControl,
} from '@/shared/api';
import type { ILocalizer } from '@/shared/i18n';
import type { ILocationSource } from '@/shared/routing';
import type { IThemePreferenceStore } from '@/shared/theme';

import {
  ApiRuntimeProvider,
  DemoPersonaGroup,
  DemoPersonaKind,
} from '@/shared/api';
import {
  createLocalizer,
  LocalizerProvider,
} from '@/shared/i18n';
import { RoutingProvider } from '@/shared/routing';
import { ThemePreferenceProvider } from '@/shared/theme';
import {
  FocusHandoffProvider,
  LiveRegionProvider,
} from '@/shared/ui';

export interface GateValue {
  open: () => void;
  promise: Promise<void>;
}

export interface ProfileDemoControlOptionsValue {
  personas?: readonly DemoPersonaListItemValue[] | undefined;
  personasGate?: GateValue | undefined;
}

export type ProfileSessionModeValue = 'error' | 'ready';

export interface ProfileSessionOptionsValue {
  sessionGate?: GateValue | undefined;
  sessionMode?: ProfileSessionModeValue | undefined;
  sides?: readonly ProfileKind[] | undefined;
}

interface ProfileTreeProvidersProps {
  children: ReactNode;
  localizer: ILocalizer;
  location: ILocationSource;
  runtime: ApiRuntimeValue;
  themeStore: IThemePreferenceStore;
}

export const PROFILE_CUSTOMER_PERSONA: DemoPersonaListItemValue = {
  group: DemoPersonaGroup.FRESH,
  id: 'f9000001-0000-4000-8000-000000000000',
  kind: DemoPersonaKind.CUSTOMER,
  organizationId: 'f9100001-0000-4000-8000-000000000000',
  organizationName: 'Заказчик 1',
  roleName: 'Администратор',
  userDisplayName: 'Анна Смирнова',
  userId: 'f9200001-0000-4000-8000-000000000000',
};

export const PROFILE_SUPPLIER_PERSONA: DemoPersonaListItemValue = {
  group: DemoPersonaGroup.FRESH,
  id: 'f9000002-0000-4000-8000-000000000000',
  kind: DemoPersonaKind.SUPPLIER,
  organizationId: 'f9100002-0000-4000-8000-000000000000',
  organizationName: 'Поставщик 1',
  roleName: 'Администратор',
  userDisplayName: 'Сергей Кузнецов',
  userId: 'f9200002-0000-4000-8000-000000000000',
};

export const PROFILE_CONSTRUCTION_PERSONA: DemoPersonaListItemValue = {
  group: DemoPersonaGroup.CONSTRUCTION,
  id: 'f9000005-0000-4000-8000-000000000000',
  kind: DemoPersonaKind.CUSTOMER,
  organizationId: 'f9100004-0000-4000-8000-000000000000',
  organizationName: 'Заказчик 2',
  roleName: 'Администратор',
  userDisplayName: 'Елена Морозова',
  userId: 'f9200005-0000-4000-8000-000000000000',
};

export const PROFILE_PERSONAS: readonly DemoPersonaListItemValue[] = [
  PROFILE_CUSTOMER_PERSONA,
  PROFILE_SUPPLIER_PERSONA,
  PROFILE_CONSTRUCTION_PERSONA,
];

export const PROFILE_ACTING_CONTEXT = {
  organizationId: PROFILE_CUSTOMER_PERSONA.organizationId,
  userId: PROFILE_CUSTOMER_PERSONA.userId,
};

export const createGate = (): GateValue => {
  let open: () => void = () => undefined;
  const promise = new Promise<void>((resolve) => {
    open = resolve;
  });

  return { open, promise };
};

const createSession = (sides: readonly ProfileKind[]): GetSessionResponse => create(GetSessionResponseSchema, {
  actingOrganizationId: PROFILE_CUSTOMER_PERSONA.organizationId,
  organizations: [
    create(OrganizationSchema, {
      id: PROFILE_CUSTOMER_PERSONA.organizationId,
      name: PROFILE_CUSTOMER_PERSONA.organizationName,
      profiles: sides.map(kind => create(OrganizationProfileSchema, { kind })),
    }),
  ],
  user: { displayName: PROFILE_CUSTOMER_PERSONA.userDisplayName, id: PROFILE_CUSTOMER_PERSONA.userId },
});

export const createProfileRoutes = ({
  sessionGate,
  sessionMode = 'ready',
  sides = [ProfileKind.CUSTOMER],
}: ProfileSessionOptionsValue = {}): ((router: ConnectRouter) => void) => (router) => {
  router.service(AccessService, {
    getSession: async () => {
      await sessionGate?.promise;

      if (sessionMode === 'error') {
        throw new ConnectError('denied', Code.PermissionDenied);
      }

      return createSession(sides);
    },
  });
};

export const createProfileDemoControl = ({
  personas = PROFILE_PERSONAS,
  personasGate,
}: ProfileDemoControlOptionsValue = {}): IDemoControl => ({
  listPersonas: () => personasGate === undefined ? Promise.resolve(personas) : personasGate.promise.then(() => personas),
  onReset: () => () => undefined,
  onStatus: () => () => undefined,
  reset: vi.fn(() => Promise.resolve()),
});

export const createProfileLocalizer = (): Promise<ILocalizer> => createLocalizer({
  bundledLocales: ['ru'],
  catalogLoaders: { ru: () => Promise.resolve(defaultLocaleCatalog) },
  requestedLocale: undefined,
  tenant: { availableLocales: ['ru'], defaultLocale: 'ru', termOverrides: {} },
  userTimeZone: 'UTC',
});

export const ProfileTreeProviders = ({
  children,
  localizer,
  location,
  runtime,
  themeStore,
}: ProfileTreeProvidersProps): ReactElement => {
  const [queryClient] = useState(() => new QueryClient({ defaultOptions: { queries: { networkMode: 'always', retry: false } } }));

  return (
    <ThemePreferenceProvider store={themeStore}>
      <RoutingProvider location={location}>
        <LocalizerProvider localizer={localizer}>
          <ApiRuntimeProvider runtime={runtime}>
            <QueryClientProvider client={queryClient}>
              <LiveRegionProvider>
                <FocusHandoffProvider>{children}</FocusHandoffProvider>
              </LiveRegionProvider>
            </QueryClientProvider>
          </ApiRuntimeProvider>
        </LocalizerProvider>
      </RoutingProvider>
    </ThemePreferenceProvider>
  );
};
