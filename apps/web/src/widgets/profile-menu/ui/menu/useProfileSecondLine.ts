import { useProfileSummary } from '@/entities/session';
import { useCurrentPersona } from '@/features/switch-persona';
import { useI18n } from '@/shared/i18n';

export interface ProfileSecondLineValue {
  isPending: boolean;
  text: string;
}

export const useProfileSecondLine = (): ProfileSecondLineValue => {
  const { t } = useI18n();
  const summaryState = useProfileSummary();
  const { isPending, persona } = useCurrentPersona();

  const organizationName = summaryState.kind === 'ready' ? summaryState.summary.organizationName : '';
  const roleName = persona?.roleName ?? '';
  const hasRole = roleName !== '';

  return {
    isPending,
    text: hasRole ? t('profile.role', { organization: organizationName, role: roleName }) : organizationName,
  };
};
