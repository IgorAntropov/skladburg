import {
  DataTexture,
  MeshBasicMaterial,
} from 'three';
import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  createSiteBannerMaterial,
  patchSiteBannerShader,
  SITE_BANNER_CELL_FAR_ATTRIBUTE,
  SITE_BANNER_CELL_NEAR_ATTRIBUTE,
  SITE_BANNER_PROGRAM_KEY,
} from './createSiteBannerMaterial';
import {
  createSiteBannerUniforms,
  writeSiteBannerFar,
} from './siteBannerUniforms';

const createShader = (): { fragmentShader: string; uniforms: Record<string, { value: unknown }>; vertexShader: string } => ({
  fragmentShader: '#include <common>\nvoid main() {\n#include <map_fragment>\n}',
  uniforms: {},
  vertexShader: '#include <common>\nvoid main() {\n#include <begin_vertex>\n}',
});

describe('createSiteBannerMaterial', () => {
  const texture = new DataTexture(new Uint8Array(4), 1, 1);

  it('is a basic material that no light and no tone mapping touches and that cuts the plate by alpha', () => {
    const material = createSiteBannerMaterial(texture, createSiteBannerUniforms());

    expect(material).toBeInstanceOf(MeshBasicMaterial);
    expect(material.toneMapped).toBe(false);
    expect(material.alphaTest).toBe(0.5);
    expect(material.alphaToCoverage).toBe(true);
    expect(material.map).toBe(texture);
    expect(material.transparent).toBe(false);
  });

  it('has its own program key so that no other basic material shares its program', () => {
    const material = createSiteBannerMaterial(texture, createSiteBannerUniforms());

    expect(material.customProgramCacheKey()).toBe(SITE_BANNER_PROGRAM_KEY);
    expect(createSiteBannerMaterial(texture, createSiteBannerUniforms()).customProgramCacheKey()).toBe(SITE_BANNER_PROGRAM_KEY);
  });
});

describe('patchSiteBannerShader', () => {
  it('shares the uniform objects with the material so that a write reaches the shader', () => {
    const uniforms = createSiteBannerUniforms();
    const shader = createShader();

    patchSiteBannerShader(shader, uniforms);

    expect(shader.uniforms.uSiteBannerFar).toBe(uniforms.far);
    expect(shader.uniforms.uSiteBannerNearSize).toBe(uniforms.nearSize);
    expect(shader.uniforms.uSiteBannerFarSize).toBe(uniforms.farSize);

    writeSiteBannerFar(uniforms, false);

    expect(shader.uniforms.uSiteBannerFar?.value).toBe(0);
  });

  it('declares the cell attributes, sizes the quad by the view and picks the cell of the view', () => {
    const shader = createShader();

    patchSiteBannerShader(shader, createSiteBannerUniforms());

    expect(shader.vertexShader).toContain(`attribute vec4 ${SITE_BANNER_CELL_NEAR_ATTRIBUTE};`);
    expect(shader.vertexShader).toContain(`attribute vec4 ${SITE_BANNER_CELL_FAR_ATTRIBUTE};`);
    expect(shader.vertexShader).toContain('transformed.xy *= mix(uSiteBannerNearSize, uSiteBannerFarSize, uSiteBannerFar);');
    expect(shader.vertexShader.indexOf('uniform float uSiteBannerFar;')).toBeLessThan(shader.vertexShader.indexOf('void main'));
    expect(shader.vertexShader.indexOf('#include <begin_vertex>')).toBeLessThan(shader.vertexShader.indexOf('transformed.xy'));
    expect(shader.fragmentShader).not.toContain('#include <map_fragment>');
    expect(shader.fragmentShader).toContain('diffuseColor *= texture2D(map, siteBannerAtlasUv);');
  });

  it('writes no comments into the shader source', () => {
    const shader = createShader();

    patchSiteBannerShader(shader, createSiteBannerUniforms());

    expect(shader.vertexShader).not.toContain('//');
    expect(shader.vertexShader).not.toContain('/*');
    expect(shader.fragmentShader).not.toContain('//');
    expect(shader.fragmentShader).not.toContain('/*');
  });
});

describe('site banner uniforms', () => {
  it('start in the far view with the metric sizes of both views', () => {
    const uniforms = createSiteBannerUniforms();

    expect(uniforms.far.value).toBe(1);
    expect(uniforms.nearSize.value.toArray()).toEqual([3.2, 1.6]);
    expect(uniforms.farSize.value.toArray()).toEqual([2, 2]);
  });

  it('write the view as one or zero', () => {
    const uniforms = createSiteBannerUniforms();

    writeSiteBannerFar(uniforms, false);
    expect(uniforms.far.value).toBe(0);
    writeSiteBannerFar(uniforms, true);
    expect(uniforms.far.value).toBe(1);
  });
});
