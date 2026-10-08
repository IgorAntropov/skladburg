import type {
  ReactElement,
  ReactNode,
} from 'react';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import type { ILocalizer } from '@/shared/i18n';
import type { TenantSettingsValue } from '@/shared/tenant';

import {
  toTenantSettings,
  useOrganizationSettingsQuery,
} from '@/entities/organization';
import { TenantSettingsProvider } from '@/shared/tenant';

import { StartErrorScreen } from './StartErrorScreen';

interface TenantSettingsGateProps {
  children: ReactNode;
  localizer: ILocalizer;
}

export const TenantSettingsGate = ({ children, localizer }: TenantSettingsGateProps): ReactElement => {
  const { data, isError, refetch } = useOrganizationSettingsQuery();

  const [appliedSettings, setAppliedSettings] = useState<TenantSettingsValue | undefined>(undefined);
  const [failedSettings, setFailedSettings] = useState<TenantSettingsValue | undefined>(undefined);
  const [isRetrying, setIsRetrying] = useState(false);
  const requestedSettingsRef = useRef<TenantSettingsValue | undefined>(undefined);

  const settings = useMemo(() => (data === undefined ? undefined : toTenantSettings(data)), [data]);

  const isApplyFailed = failedSettings !== undefined && failedSettings === settings;
  const isRequestFailed = isError && appliedSettings === undefined;
  const isStartErrorVisible = isApplyFailed || isRequestFailed || isRetrying;

  const applySettings = useCallback(async (nextSettings: TenantSettingsValue): Promise<void> => {
    requestedSettingsRef.current = nextSettings;

    try {
      await localizer.applyTenant(nextSettings);
    }
    catch (error) {
      console.error('> TenantSettingsGate -> applyTenant:', { error, tenantId: nextSettings.tenantId });
      if (requestedSettingsRef.current === nextSettings) {
        setFailedSettings(nextSettings);
      }

      return;
    }

    if (requestedSettingsRef.current === nextSettings) {
      setAppliedSettings(nextSettings);
    }
  }, [localizer]);

  const handleRetry = async (): Promise<void> => {
    console.log('> TenantSettingsGate -> handleRetry:', { isApplyFailed, isRequestFailed });
    setIsRetrying(true);
    setFailedSettings(undefined);

    try {
      await Promise.all([
        refetch(),
        settings === undefined ? Promise.resolve() : applySettings(settings),
      ]);
    }
    finally {
      setIsRetrying(false);
    }
  };

  useEffect(() => {
    if (settings === undefined || requestedSettingsRef.current === settings) {
      return;
    }

    void applySettings(settings);
  }, [settings, applySettings]);

  if (isStartErrorVisible) {
    return <StartErrorScreen onRetry={handleRetry} />;
  }

  if (appliedSettings === undefined) {
    return <main aria-busy className="min-h-dvh bg-surface" />;
  }

  return <TenantSettingsProvider tenantSettings={appliedSettings}>{children}</TenantSettingsProvider>;
};
