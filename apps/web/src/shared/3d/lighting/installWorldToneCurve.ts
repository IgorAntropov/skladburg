import { ShaderChunk } from 'three';

import {
  buildWorldToneCurveGlsl,
  WORLD_TONE_FUNCTION_NAME,
} from './worldToneCurve';

export const CUSTOM_TONE_MAPPING_STUB = 'vec3 CustomToneMapping( vec3 color ) { return color; }';

const TONE_MAPPING_CHUNK_NAME = 'tonemapping_pars_fragment';

const CUSTOM_TONE_MAPPING_BODY = `vec3 CustomToneMapping( vec3 color ) { return ${WORLD_TONE_FUNCTION_NAME}( color ); }`;

export const injectWorldToneCurve = (chunk: string): string => {
  if (chunk.includes(WORLD_TONE_FUNCTION_NAME)) {
    return chunk;
  }

  if (!chunk.includes(CUSTOM_TONE_MAPPING_STUB)) {
    throw new Error(`Tone mapping chunk has no custom tone mapping stub to replace: ${CUSTOM_TONE_MAPPING_STUB}`);
  }

  return chunk.replace(CUSTOM_TONE_MAPPING_STUB, () => `${buildWorldToneCurveGlsl()}\n\n${CUSTOM_TONE_MAPPING_BODY}`);
};

export const installWorldToneCurve = (): void => {
  const chunks: Record<string, string | undefined> = ShaderChunk;
  const chunk = chunks[TONE_MAPPING_CHUNK_NAME];

  if (chunk === undefined) {
    throw new Error(`Shader chunk is missing: ${TONE_MAPPING_CHUNK_NAME}`);
  }

  ShaderChunk[TONE_MAPPING_CHUNK_NAME] = injectWorldToneCurve(chunk);
};
