import { ShaderChunk } from 'three';
import {
  afterEach,
  describe,
  expect,
  it,
} from 'vitest';

import {
  CUSTOM_TONE_MAPPING_STUB,
  injectWorldToneCurve,
  installWorldToneCurve,
} from './installWorldToneCurve';
import {
  buildWorldToneCurveGlsl,
  WORLD_TONE_FUNCTION_NAME,
} from './worldToneCurve';

const CHUNK_NAME = 'tonemapping_pars_fragment';
const originalChunk = ShaderChunk[CHUNK_NAME];

describe('injectWorldToneCurve', () => {
  it('replaces the custom stub with the world curve', () => {
    const result = injectWorldToneCurve(originalChunk);

    expect(result).toContain(buildWorldToneCurveGlsl());
    expect(result).toContain(`vec3 CustomToneMapping( vec3 color ) { return ${WORLD_TONE_FUNCTION_NAME}( color ); }`);
    expect(result).not.toContain(CUSTOM_TONE_MAPPING_STUB);
    expect(result).toContain('vec3 NeutralToneMapping( vec3 color )');
  });

  it('does nothing on a second pass', () => {
    const once = injectWorldToneCurve(originalChunk);

    expect(injectWorldToneCurve(once)).toBe(once);
  });

  it('fails loudly when the stub is missing', () => {
    expect(() => injectWorldToneCurve('vec3 SomethingElse( vec3 color ) { return color; }')).toThrow(/custom tone mapping stub/);
  });
});

describe('installWorldToneCurve', () => {
  afterEach(() => {
    ShaderChunk[CHUNK_NAME] = originalChunk;
  });

  it('writes the curve into the shared chunk once', () => {
    installWorldToneCurve();

    const installed = ShaderChunk[CHUNK_NAME];

    installWorldToneCurve();

    expect(installed).toContain(buildWorldToneCurveGlsl());
    expect(ShaderChunk[CHUNK_NAME]).toBe(installed);
  });
});
