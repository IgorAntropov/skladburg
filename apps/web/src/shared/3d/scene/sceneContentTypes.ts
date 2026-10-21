import type { QualityLevelValue } from '../quality/qualityLevel';

export interface SceneContentProps<TData, TInteraction = undefined> {
  data: TData;
  interaction: TInteraction;
  level: QualityLevelValue;
}
