export const getNextTabIndex = (
  key: string,
  currentIndex: number,
  count: number,
): number | undefined => {
  if (count < 1) {
    return undefined;
  }

  switch (key) {
    case 'ArrowLeft':
      return (currentIndex - 1 + count) % count;
    case 'ArrowRight':
      return (currentIndex + 1) % count;
    case 'End':
      return count - 1;
    case 'Home':
      return 0;
    default:
      return undefined;
  }
};
