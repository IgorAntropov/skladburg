export const BANNER_PLATE_RED = 250;

export const BANNER_PLATE_GREEN = 245;

export const BANNER_PLATE_BLUE = 233;

export const BANNER_PLATE_MAX_DELTA_E = 2;

export const createCountPlatePixelsScript = (base64: string): string => `
(async (base64) => {
  const image = new Image();

  image.src = 'data:image/png;base64,' + base64;
  await image.decode();

  const canvas = document.createElement('canvas');

  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;

  const context = canvas.getContext('2d', { willReadFrequently: true });

  context.drawImage(image, 0, 0);

  const { data, width, height } = context.getImageData(0, 0, canvas.width, canvas.height);
  const whiteX = 0.95047;
  const whiteY = 1;
  const whiteZ = 1.08883;
  const linearByChannel = Array.from({ length: 256 }, (_, value) => {
    const channel = value / 255;

    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });

  const toLabComponent = (value) => (value > 216 / 24389 ? Math.cbrt(value) : (24389 / 27 * value + 16) / 116);

  const toLab = (red, green, blue) => {
    const linearRed = linearByChannel[red];
    const linearGreen = linearByChannel[green];
    const linearBlue = linearByChannel[blue];
    const x = toLabComponent((0.4124564 * linearRed + 0.3575761 * linearGreen + 0.1804375 * linearBlue) / whiteX);
    const y = toLabComponent((0.2126729 * linearRed + 0.7151522 * linearGreen + 0.072175 * linearBlue) / whiteY);
    const z = toLabComponent((0.0193339 * linearRed + 0.119192 * linearGreen + 0.9503041 * linearBlue) / whiteZ);

    return { a: 500 * (x - y), b: 200 * (y - z), l: 116 * y - 16 };
  };

  const plate = toLab(${String(BANNER_PLATE_RED)}, ${String(BANNER_PLATE_GREEN)}, ${String(BANNER_PLATE_BLUE)});
  const cache = new Map();
  let plateCount = 0;

  for (let offset = 0; offset < data.length; offset += 4) {
    const key = (data[offset] << 16) | (data[offset + 1] << 8) | data[offset + 2];
    let isPlate = cache.get(key);

    if (isPlate === undefined) {
      const lab = toLab(data[offset], data[offset + 1], data[offset + 2]);

      isPlate = Math.hypot(lab.l - plate.l, lab.a - plate.a, lab.b - plate.b) <= ${String(BANNER_PLATE_MAX_DELTA_E)};
      cache.set(key, isPlate);
    }

    if (isPlate) {
      plateCount += 1;
    }
  }

  return { height, plateCount, width };
})(${JSON.stringify(base64)})
`;
