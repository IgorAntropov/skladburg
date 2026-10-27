import type { ReactElement } from 'react';

import {
  useEffect,
  useState,
} from 'react';

import type { NotificationReplicaSlotValue } from '@/widgets/notification-center';

import { CollapseHudPanelsButton } from '@/features/collapse-hud-panels';
import {
  getAddressSection,
  useAddress,
} from '@/shared/routing';
import { AssistantLauncher } from '@/widgets/assistant';
import {
  NotificationCenterLauncher,
  UnreadCountReporter,
} from '@/widgets/notification-center';
import { ProfileMenuLauncher } from '@/widgets/profile-menu';
import { TopBar } from '@/widgets/top-bar';

import { useAvailableSections } from '../access';
import { scheduleWhenIdle } from '../lib/scheduleWhenIdle';

const NO_SECTIONS: readonly never[] = [];

export const AppTopBar = (): ReactElement => {
  const { address } = useAddress();
  const availableSections = useAvailableSections();
  const [isReporterMounted, setIsReporterMounted] = useState(false);

  const currentSection = address === undefined ? undefined : getAddressSection(address);
  const sections = availableSections.kind === 'ready' ? availableSections.sections : NO_SECTIONS;
  const unreadCountReporter = isReporterMounted ? <UnreadCountReporter /> : undefined;

  const renderReplica = ({ isPanelOpen, openCenter }: NotificationReplicaSlotValue): ReactElement | undefined => {
    return isReporterMounted ? <AssistantLauncher isPanelOpen={isPanelOpen} onOpenCenter={openCenter} /> : undefined;
  };

  useEffect(() => {
    return scheduleWhenIdle(() => {
      setIsReporterMounted(true);
    });
  }, []);

  return (
    <TopBar
      assistant={<NotificationCenterLauncher renderReplica={renderReplica} unreadCountReporter={unreadCountReporter} />}
      currentSection={currentSection}
      panelsToggle={<CollapseHudPanelsButton />}
      profileMenu={<ProfileMenuLauncher currentSection={currentSection} sections={sections} />}
      sections={sections}
    />
  );
};
