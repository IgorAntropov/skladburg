import { useAssistantQuietModeStore } from './useAssistantQuietModeStore';

export interface AssistantQuietModeValue {
  isQuiet: boolean;
  setQuiet: (isQuiet: boolean) => void;
}

export const useAssistantQuietMode = (): AssistantQuietModeValue => {
  const isQuiet = useAssistantQuietModeStore(state => state.isQuiet);
  const setQuiet = useAssistantQuietModeStore(state => state.setQuiet);

  return { isQuiet, setQuiet };
};
