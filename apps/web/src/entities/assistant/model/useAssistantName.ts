import { useI18n } from '@/shared/i18n';

export const useAssistantName = (): string => {
  const { t } = useI18n();

  return t('assistant.name');
};
