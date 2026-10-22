import type { OrganizationProfile } from '@skladburg/contracts/organization/v1/organization';
import type { ReactElement } from 'react';

import { Check } from 'lucide-react';

import {
  normalizeVerificationLevel,
  ProfileBadge,
  VERIFICATION_LEVEL_CHECKED_KEYS,
} from '@/entities/organization';
import { useI18n } from '@/shared/i18n';

interface OrganizationProfileCardProps {
  profile: OrganizationProfile;
}

const CHECKED_STEPS = [1, 2, 3, 4] as const;

export const OrganizationProfileCard = ({ profile }: OrganizationProfileCardProps): ReactElement => {
  const { t } = useI18n();

  const level = normalizeVerificationLevel(profile.verificationLevel);
  const checkedSteps = CHECKED_STEPS.filter(step => step <= level);

  return (
    <li
      className="flex flex-col gap-2 rounded-control border border-line p-3"
      data-level={level}
      data-testid="organization-profile-card"
    >
      <ProfileBadge kind={profile.kind} level={profile.verificationLevel} />
      <p className="text-sm leading-5 text-on-panel-muted">{t('organization.card.checked')}</p>
      {checkedSteps.length === 0
        ? <p className="text-sm leading-5 text-on-panel-muted">{t(VERIFICATION_LEVEL_CHECKED_KEYS[0])}</p>
        : (
            <ul className="flex flex-col gap-1.5">
              {checkedSteps.map(step => (
                <li className="flex items-start gap-2" key={step}>
                  <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-on-panel" />
                  <span className="text-sm leading-5 text-on-panel">{t(VERIFICATION_LEVEL_CHECKED_KEYS[step])}</span>
                </li>
              ))}
            </ul>
          )}
    </li>
  );
};
