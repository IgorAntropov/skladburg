import type { AppSectionValue } from '@/shared/routing';

export const selectLandingSection = (sections: readonly AppSectionValue[]): AppSectionValue | undefined => sections[0];
