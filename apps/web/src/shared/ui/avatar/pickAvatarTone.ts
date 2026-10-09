import { hashFnv1a32 } from './hashFnv1a32';

export const pickAvatarTone = (seed: string, toneCount: number): number => hashFnv1a32(seed) % toneCount;
