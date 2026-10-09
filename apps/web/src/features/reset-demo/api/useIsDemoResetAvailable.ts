import { useDemoControl } from '@/shared/api';

export const useIsDemoResetAvailable = (): boolean => useDemoControl() !== undefined;
