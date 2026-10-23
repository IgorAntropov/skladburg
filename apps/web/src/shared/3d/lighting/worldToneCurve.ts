export type LinearRgbValue = readonly [number, number, number];

interface WorldToneCurveValue {
  readonly compressionStart: number;
  readonly desaturation: number;
}

export const WORLD_TONE_CURVE: WorldToneCurveValue = {
  compressionStart: 0.8,
  desaturation: 0.15,
};

export const WORLD_TONE_FUNCTION_NAME = 'worldToneCurve';

const toGlslFloat = (value: number): string => {
  return Number.isInteger(value) ? value.toFixed(1) : String(value);
};

export const applyWorldToneCurve = (color: LinearRgbValue, exposure: number): LinearRgbValue => {
  const red = color[0] * exposure;
  const green = color[1] * exposure;
  const blue = color[2] * exposure;
  const peak = Math.max(red, green, blue);
  const { compressionStart, desaturation } = WORLD_TONE_CURVE;

  if (peak < compressionStart) {
    return [red, green, blue];
  }

  const room = 1 - compressionStart;
  const newPeak = 1 - (room * room) / (peak + room - compressionStart);
  const scale = newPeak / peak;
  const blend = 1 - 1 / (desaturation * (peak - newPeak) + 1);

  return [
    red * scale + (newPeak - red * scale) * blend,
    green * scale + (newPeak - green * scale) * blend,
    blue * scale + (newPeak - blue * scale) * blend,
  ];
};

export const buildWorldToneCurveGlsl = (): string => {
  const { compressionStart, desaturation } = WORLD_TONE_CURVE;

  return [
    `vec3 ${WORLD_TONE_FUNCTION_NAME}( vec3 color ) {`,
    `const float StartCompression = ${toGlslFloat(compressionStart)};`,
    `const float Desaturation = ${toGlslFloat(desaturation)};`,
    'color *= toneMappingExposure;',
    'float peak = max( color.r, max( color.g, color.b ) );',
    'if ( peak < StartCompression ) return color;',
    'float d = 1.0 - StartCompression;',
    'float newPeak = 1.0 - d * d / ( peak + d - StartCompression );',
    'color *= newPeak / peak;',
    'float g = 1.0 - 1.0 / ( Desaturation * ( peak - newPeak ) + 1.0 );',
    'return mix( color, vec3( newPeak ), g );',
    '}',
  ].join('\n');
};
