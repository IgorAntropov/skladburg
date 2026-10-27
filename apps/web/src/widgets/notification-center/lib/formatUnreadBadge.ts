const MAX_BADGE_COUNT = 99;

export const formatUnreadBadge = (count: number): string => {
  return count > MAX_BADGE_COUNT ? `${String(MAX_BADGE_COUNT)}+` : String(count);
};
