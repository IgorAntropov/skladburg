import type {
  Texture,
  WebGLProgramParametersWithUniforms,
} from 'three';

import { MeshBasicMaterial } from 'three';

import type { SiteBannerUniformsValue } from './siteBannerUniforms';

export const SITE_BANNER_CELL_NEAR_ATTRIBUTE = 'aSiteBannerCellNear';

export const SITE_BANNER_CELL_FAR_ATTRIBUTE = 'aSiteBannerCellFar';

export const SITE_BANNER_PROGRAM_KEY = 'site-banner';

const COMMON_ANCHOR = '#include <common>';

const BEGIN_VERTEX_ANCHOR = '#include <begin_vertex>';

const MAP_FRAGMENT_ANCHOR = '#include <map_fragment>';

const ALPHA_TEST_THRESHOLD = 0.5;

const VERTEX_DECLARATIONS = [
  `attribute vec4 ${SITE_BANNER_CELL_NEAR_ATTRIBUTE};`,
  `attribute vec4 ${SITE_BANNER_CELL_FAR_ATTRIBUTE};`,
  'uniform float uSiteBannerFar;',
  'uniform vec2 uSiteBannerNearSize;',
  'uniform vec2 uSiteBannerFarSize;',
  'varying vec2 vSiteBannerUv;',
  'varying vec4 vSiteBannerCell;',
].join('\n');

const VERTEX_BODY = [
  'transformed.xy *= mix(uSiteBannerNearSize, uSiteBannerFarSize, uSiteBannerFar);',
  'vSiteBannerUv = uv;',
  `vSiteBannerCell = mix(${SITE_BANNER_CELL_NEAR_ATTRIBUTE}, ${SITE_BANNER_CELL_FAR_ATTRIBUTE}, uSiteBannerFar);`,
].join('\n');

const FRAGMENT_DECLARATIONS = [
  'varying vec2 vSiteBannerUv;',
  'varying vec4 vSiteBannerCell;',
].join('\n');

const FRAGMENT_BODY = [
  'vec2 siteBannerAtlasUv = vec2(',
  '  mix(vSiteBannerCell.x, vSiteBannerCell.y, vSiteBannerUv.x),',
  '  mix(vSiteBannerCell.z, vSiteBannerCell.w, vSiteBannerUv.y)',
  ');',
  'diffuseColor *= texture2D(map, siteBannerAtlasUv);',
].join('\n');

const insertAfter = (source: string, anchor: string, addition: string): string => (
  source.replace(anchor, () => `${anchor}\n${addition}`)
);

export const patchSiteBannerShader = (
  shader: Pick<WebGLProgramParametersWithUniforms, 'fragmentShader' | 'uniforms' | 'vertexShader'>,
  uniforms: SiteBannerUniformsValue,
): void => {
  shader.uniforms.uSiteBannerFar = uniforms.far;
  shader.uniforms.uSiteBannerFarSize = uniforms.farSize;
  shader.uniforms.uSiteBannerNearSize = uniforms.nearSize;
  shader.vertexShader = insertAfter(
    insertAfter(shader.vertexShader, COMMON_ANCHOR, VERTEX_DECLARATIONS),
    BEGIN_VERTEX_ANCHOR,
    VERTEX_BODY,
  );
  shader.fragmentShader = shader.fragmentShader
    .replace(COMMON_ANCHOR, () => `${COMMON_ANCHOR}\n${FRAGMENT_DECLARATIONS}`)
    .replace(MAP_FRAGMENT_ANCHOR, () => FRAGMENT_BODY);
};

export const createSiteBannerMaterial = (texture: Texture, uniforms: SiteBannerUniformsValue): MeshBasicMaterial => {
  const material = new MeshBasicMaterial({
    alphaTest: ALPHA_TEST_THRESHOLD,
    alphaToCoverage: true,
    map: texture,
    toneMapped: false,
  });

  material.onBeforeCompile = (shader): void => {
    patchSiteBannerShader(shader, uniforms);
  };
  material.customProgramCacheKey = (): string => SITE_BANNER_PROGRAM_KEY;

  return material;
};
