import type {
  Color,
  IUniform,
} from 'three';

import { WORLD_GLOW_RAMP } from './computeGlowIntensity';

export const WORLD_GLOW_DELAY_ATTRIBUTE = 'glowDelay';

export const GLOW_DAY_NIGHT_UNIFORM = 'glowDayNight';
export const GLOW_OFF_COLOR_UNIFORM = 'glowOffColor';
export const GLOW_STRENGTH_UNIFORM = 'glowStrength';
export const GLOW_INTENSITY_VARYING = 'vGlowIntensity';

export const GLOW_COMMON_ANCHOR = '#include <common>';
export const GLOW_BEGIN_VERTEX_ANCHOR = '#include <begin_vertex>';
export const GLOW_COLOR_FRAGMENT_ANCHOR = '#include <color_fragment>';
export const GLOW_COLORSPACE_FRAGMENT_ANCHOR = '#include <colorspace_fragment>';

export const GLOW_OPAQUE_PROGRAM_KEY = 'world-glow-opaque';
export const GLOW_ADDITIVE_PROGRAM_KEY = 'world-glow-additive';

export interface GlowShaderTargetValue {
  fragmentShader: string;
  uniforms: Record<string, IUniform>;
  vertexShader: string;
}

const RAMP_LITERAL = WORLD_GLOW_RAMP.toFixed(4);

const GLOW_INTENSITY_EXPRESSION = [
  `${GLOW_INTENSITY_VARYING} = smoothstep(`,
  `${WORLD_GLOW_DELAY_ATTRIBUTE}, ${WORLD_GLOW_DELAY_ATTRIBUTE} + ${RAMP_LITERAL}, ${GLOW_DAY_NIGHT_UNIFORM}`,
  ');',
].join('');

const insertAfter = (source: string, anchor: string, addition: string): string => {
  return source.replace(anchor, () => `${anchor}\n${addition}`);
};

const patchVertexShader = (source: string): string => {
  const withDeclarations = insertAfter(
    source,
    GLOW_COMMON_ANCHOR,
    [
      `attribute float ${WORLD_GLOW_DELAY_ATTRIBUTE};`,
      `uniform float ${GLOW_DAY_NIGHT_UNIFORM};`,
      `varying float ${GLOW_INTENSITY_VARYING};`,
    ].join('\n'),
  );

  return insertAfter(
    withDeclarations,
    GLOW_BEGIN_VERTEX_ANCHOR,
    GLOW_INTENSITY_EXPRESSION,
  );
};

export const patchOpaqueGlowShader = (
  target: GlowShaderTargetValue,
  dayNight: IUniform<number>,
  offColor: IUniform<Color>,
): void => {
  target.uniforms[GLOW_DAY_NIGHT_UNIFORM] = dayNight;
  target.uniforms[GLOW_OFF_COLOR_UNIFORM] = offColor;
  target.vertexShader = patchVertexShader(target.vertexShader);

  const withDeclarations = insertAfter(
    target.fragmentShader,
    GLOW_COMMON_ANCHOR,
    [
      `uniform vec3 ${GLOW_OFF_COLOR_UNIFORM};`,
      `varying float ${GLOW_INTENSITY_VARYING};`,
    ].join('\n'),
  );

  target.fragmentShader = insertAfter(
    withDeclarations,
    GLOW_COLOR_FRAGMENT_ANCHOR,
    `diffuseColor.rgb = mix(${GLOW_OFF_COLOR_UNIFORM}, diffuseColor.rgb, ${GLOW_INTENSITY_VARYING});`,
  );
};

export const patchAdditiveGlowShader = (
  target: GlowShaderTargetValue,
  dayNight: IUniform<number>,
  strength: IUniform<number>,
): void => {
  target.uniforms[GLOW_DAY_NIGHT_UNIFORM] = dayNight;
  target.uniforms[GLOW_STRENGTH_UNIFORM] = strength;
  target.vertexShader = patchVertexShader(target.vertexShader);

  const withDeclarations = insertAfter(
    target.fragmentShader,
    GLOW_COMMON_ANCHOR,
    [
      `uniform float ${GLOW_STRENGTH_UNIFORM};`,
      `varying float ${GLOW_INTENSITY_VARYING};`,
    ].join('\n'),
  );

  target.fragmentShader = insertAfter(
    withDeclarations,
    GLOW_COLORSPACE_FRAGMENT_ANCHOR,
    `gl_FragColor.rgb *= ${GLOW_INTENSITY_VARYING} * ${GLOW_STRENGTH_UNIFORM};`,
  );
};
