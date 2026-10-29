import type { ReactElement } from 'react';

import {
  useEffect,
  useState,
} from 'react';

import type {
  NotificationHelpTabSlotValue,
  NotificationReplicaSlotValue,
} from '@/widgets/notification-center';

import { useProfileSummary } from '@/entities/session';
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
import { SupportChatLauncher } from '@/widgets/support-chat';
import { TopBar } from '@/widgets/top-bar';

import { useAvailableSections } from '../access';
import { scheduleWhenIdle } from '../lib/scheduleWhenIdle';

const NO_SECTIONS: readonly never[] = [];

export const AppTopBar = (): ReactElement => {
  const { address } = useAddress();
  const availableSections = useAvailableSections();
  const profileSummary = useProfileSummary();
  const [isReporterMounted, setIsReporterMounted] = useState(false);

  const currentSection = address === undefined ? undefined : getAddressSection(address);
  const sections = availableSections.kind === 'ready' ? availableSections.sections : NO_SECTIONS;
  const unreadCountReporter = isReporterMounted ? <UnreadCountReporter /> : undefined;

  const isHelpAvailable = profileSummary.kind === 'ready' && profileSummary.summary.sides.length > 0;

  const renderHelpTab = (slot: NotificationHelpTabSlotValue): ReactElement => <SupportChatLauncher {...slot} />;

  const renderReplica = ({ isPanelOpen, openCenter }: NotificationReplicaSlotValue): ReactElement | undefined => {
    return isReporterMounted
      ? <AssistantLauncher canCallSupport={isHelpAvailable} isPanelOpen={isPanelOpen} onOpenCenter={openCenter} />
      : undefined;
  };

  const helpTabRenderer = isHelpAvailable ? renderHelpTab : undefined;

  useEffect(() => {
    return scheduleWhenIdle(() => {
      setIsReporterMounted(true);
    });
  }, []);

  return (
    <TopBar
      assistant={(
        <NotificationCenterLauncher
          renderHelpTab={helpTabRenderer}
          renderReplica={renderReplica}
          unreadCountReporter={unreadCountReporter}
        />
      )}
      currentSection={currentSection}
      panelsToggle={<CollapseHudPanelsButton />}
      profileMenu={<ProfileMenuLauncher currentSection={currentSection} sections={sections} />}
      sections={sections}
    />
  );
};
