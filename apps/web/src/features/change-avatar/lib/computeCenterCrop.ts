export interface CenterCropValue {
  size: number;
  sx: number;
  sy: number;
}

export const computeCenterCrop = (width: number, height: number): CenterCropValue => {
  const size = Math.min(width, height);

  return {
    size,
    sx: Math.floor((width - size) / 2),
    sy: Math.floor((height - size) / 2),
  };
};
