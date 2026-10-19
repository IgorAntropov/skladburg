export const compareCodeUnits = (current: string, next: string): number => {
  if (current === next) {
    return 0;
  }

  return current < next ? -1 : 1;
};
