import type {
  MeshBasicMaterial,
  WebGLProgramParametersWithUniforms,
} from 'three';

import {
  AdditiveBlending,
  Color,
  ShaderLib,
  SRGBColorSpace,
} from 'three';
import {
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import type { WorldPaletteKeyValue } from '../palette/worldPaletteKeys';
import type { GlowShaderTargetValue } from './glowShader';

import { readWorldPalette } from '../palette/readWorldPalette';
import { WORLD_PALETTE_KEYS } from '../palette/worldPaletteKeys';
import { WORLD_GLOW_RAMP } from './computeGlowIntensity';
import {
  createWorldGlowMaterialRegistry,
  GLOW_VISIBLE_EPSILON,
} from './createWorldGlowMaterialRegistry';
import {
  GLOW_ADDITIVE_PROGRAM_KEY,
  GLOW_BEGIN_VERTEX_ANCHOR,
  GLOW_COLOR_FRAGMENT_ANCHOR,
  GLOW_COLORSPACE_FRAGMENT_ANCHOR,
  GLOW_COMMON_ANCHOR,
  GLOW_DAY_NIGHT_UNIFORM,
  GLOW_INTENSITY_VARYING,
  GLOW_OFF_COLOR_UNIFORM,
  GLOW_OPAQUE_PROGRAM_KEY,
  GLOW_STRENGTH_UNIFORM,
  WORLD_GLOW_DELAY_ATTRIBUTE,
} from './glowShader';

const CHANNEL_MAX = 255;

const FIRST_COLORS: Readonly<Partial<Record<WorldPaletteKeyValue, string>>> = {
  plaza: '#324b64',
  road: '#0a141e',
  sideCustomer: '#c8d2dc',
};

const SECOND_COLORS: Readonly<Partial<Record<WorldPaletteKeyValue, string>>> = {
  plaza: '#646464',
  road: '#6496c8',
  sideCustomer: '#fa8c1e',
};

const createPalette = (colors: Readonly<Partial<Record<WorldPaletteKeyValue, string>>>): ReturnType<typeof readWorldPalette> => {
  const colorByToken = new Map<string, string>(
    Object.entries(colors).map(([key, color]) => [WORLD_PALETTE_KEYS[key as WorldPaletteKeyValue], color]),
  );

  return readWorldPalette(token => colorByToken.get(token) ?? '#808080');
};

const readChannels = (color: Color): number[] => {
  const target = {
    b: 0,
    g: 0,
    r: 0,
  };
  color.getRGB(target, SRGBColorSpace);

  return [target.r, target.g, target.b].map(channel => Math.round(channel * CHANNEL_MAX));
};

const readOffColor = (shader: GlowShaderTargetValue): Color | undefined => {
  const offColor: unknown = shader.uniforms[GLOW_OFF_COLOR_UNIFORM]?.value;

  return offColor instanceof Color ? offColor : undefined;
};

const compile = (material: MeshBasicMaterial): GlowShaderTargetValue => {
  const shader: GlowShaderTargetValue = {
    fragmentShader: ShaderLib.basic.fragmentShader,
    uniforms: {},
    vertexShader: ShaderLib.basic.vertexShader,
  };

  material.onBeforeCompile(shader as WebGLProgramParametersWithUniforms, undefined as never);

  return shader;
};

describe('createWorldGlowMaterialRegistry', () => {
  describe('cache', () => {
    it('returns one instance per specification', () => {
      const registry = createWorldGlowMaterialRegistry(createPalette(FIRST_COLORS));

      expect(registry.get({ key: 'road', kind: 'unlit' })).toBe(registry.get({ key: 'road', kind: 'unlit' }));
      expect(registry.get({ key: 'road', kind: 'nightOpaque', offKey: 'plaza' }))
        .toBe(registry.get({ key: 'road', kind: 'nightOpaque', offKey: 'plaza' }));
      expect(registry.get({ key: 'road', kind: 'nightAdditive', strength: 0.5 }))
        .toBe(registry.get({ key: 'road', kind: 'nightAdditive', strength: 0.5 }));
    });

    it('returns different instances for different fields', () => {
      const registry = createWorldGlowMaterialRegistry(createPalette(FIRST_COLORS));
      const materials = [
        registry.get({ key: 'road', kind: 'unlit' }),
        registry.get({ key: 'plaza', kind: 'unlit' }),
        registry.get({ key: 'road', kind: 'nightOpaque', offKey: 'plaza' }),
        registry.get({ key: 'road', kind: 'nightOpaque', offKey: 'sideCustomer' }),
        registry.get({ key: 'road', kind: 'nightAdditive', strength: 0.5 }),
        registry.get({ key: 'road', kind: 'nightAdditive', strength: 0.6 }),
      ];

      expect(new Set(materials).size).toBe(materials.length);
    });
  });

  describe('unlit', () => {
    it('keeps the key color without a shader patch', () => {
      const registry = createWorldGlowMaterialRegistry(createPalette(FIRST_COLORS));
      const material = registry.get({ key: 'road', kind: 'unlit' });

      expect(readChannels(material.color)).toEqual([10, 20, 30]);
      expect(material.transparent).toBe(false);
      expect(material.visible).toBe(true);
      expect(material.customProgramCacheKey()).not.toBe(GLOW_OPAQUE_PROGRAM_KEY);
      expect(material.customProgramCacheKey()).not.toBe(GLOW_ADDITIVE_PROGRAM_KEY);
    });

    it('stays the same color at any hour', () => {
      const registry = createWorldGlowMaterialRegistry(createPalette(FIRST_COLORS));
      const material = registry.get({ key: 'road', kind: 'unlit' });

      registry.applyDayNight(1);

      expect(readChannels(material.color)).toEqual([10, 20, 30]);
      expect(material.visible).toBe(true);
    });

    it('recolors in place when the palette changes', () => {
      const registry = createWorldGlowMaterialRegistry(createPalette(FIRST_COLORS));
      const material = registry.get({ key: 'road', kind: 'unlit' });

      registry.applyPalette(createPalette(SECOND_COLORS));

      expect(registry.get({ key: 'road', kind: 'unlit' })).toBe(material);
      expect(readChannels(material.color)).toEqual([100, 150, 200]);
    });

    it('creates materials requested after a palette change in the new colors', () => {
      const registry = createWorldGlowMaterialRegistry(createPalette(FIRST_COLORS));

      registry.applyPalette(createPalette(SECOND_COLORS));

      expect(readChannels(registry.get({ key: 'road', kind: 'unlit' }).color)).toEqual([100, 150, 200]);
    });
  });

  describe('nightAdditive', () => {
    it('is transparent, additive and does not write depth', () => {
      const material = createWorldGlowMaterialRegistry(createPalette(FIRST_COLORS))
        .get({ key: 'road', kind: 'nightAdditive', strength: 0.5 });

      expect(material.transparent).toBe(true);
      expect(material.depthWrite).toBe(false);
      expect(material.blending).toBe(AdditiveBlending);
    });

    it('is hidden by day and shown once the value exceeds the epsilon', () => {
      const registry = createWorldGlowMaterialRegistry(createPalette(FIRST_COLORS));
      const material = registry.get({ key: 'road', kind: 'nightAdditive', strength: 0.5 });

      expect(material.visible).toBe(false);

      registry.applyDayNight(GLOW_VISIBLE_EPSILON);
      expect(material.visible).toBe(false);

      registry.applyDayNight(GLOW_VISIBLE_EPSILON * 2);
      expect(material.visible).toBe(true);

      registry.applyDayNight(1);
      expect(material.visible).toBe(true);

      registry.applyDayNight(0);
      expect(material.visible).toBe(false);
    });

    it('is visible at creation when the night has already come', () => {
      const registry = createWorldGlowMaterialRegistry(createPalette(FIRST_COLORS));

      registry.applyDayNight(1);

      expect(registry.get({ key: 'road', kind: 'nightAdditive', strength: 0.5 }).visible).toBe(true);
    });

    it('patches the shader with the shared value and the strength', () => {
      const registry = createWorldGlowMaterialRegistry(createPalette(FIRST_COLORS));
      const shader = compile(registry.get({ key: 'road', kind: 'nightAdditive', strength: 0.35 }));

      expect(shader.uniforms[GLOW_DAY_NIGHT_UNIFORM]).toBe(registry.dayNight);
      expect(shader.uniforms[GLOW_STRENGTH_UNIFORM]?.value).toBe(0.35);
      expect(shader.uniforms[GLOW_OFF_COLOR_UNIFORM]).toBeUndefined();
      expect(shader.fragmentShader).toContain(`gl_FragColor.rgb *= ${GLOW_INTENSITY_VARYING} * ${GLOW_STRENGTH_UNIFORM};`);
      expect(shader.fragmentShader).not.toContain(GLOW_OFF_COLOR_UNIFORM);
    });
  });

  describe('nightOpaque', () => {
    it('stays visible at any hour', () => {
      const registry = createWorldGlowMaterialRegistry(createPalette(FIRST_COLORS));
      const material = registry.get({ key: 'road', kind: 'nightOpaque', offKey: 'plaza' });

      expect(material.visible).toBe(true);
      expect(material.transparent).toBe(false);

      registry.applyDayNight(0);
      expect(material.visible).toBe(true);

      registry.applyDayNight(1);
      expect(material.visible).toBe(true);
    });

    it('patches the shader with the shared value and its own off color', () => {
      const registry = createWorldGlowMaterialRegistry(createPalette(FIRST_COLORS));
      const shader = compile(registry.get({ key: 'road', kind: 'nightOpaque', offKey: 'plaza' }));
      const offColor = readOffColor(shader);

      expect(shader.uniforms[GLOW_DAY_NIGHT_UNIFORM]).toBe(registry.dayNight);
      expect(offColor).toBeInstanceOf(Color);
      expect(offColor === undefined ? [] : readChannels(offColor)).toEqual([50, 75, 100]);
      expect(shader.uniforms[GLOW_STRENGTH_UNIFORM]).toBeUndefined();
      expect(shader.fragmentShader).toContain(
        `diffuseColor.rgb = mix(${GLOW_OFF_COLOR_UNIFORM}, diffuseColor.rgb, ${GLOW_INTENSITY_VARYING});`,
      );
    });

    it('recolors the glow color and the off color in place', () => {
      const registry = createWorldGlowMaterialRegistry(createPalette(FIRST_COLORS));
      const material = registry.get({ key: 'road', kind: 'nightOpaque', offKey: 'plaza' });
      const offColor = readOffColor(compile(material));

      registry.applyPalette(createPalette(SECOND_COLORS));

      expect(readChannels(material.color)).toEqual([100, 150, 200]);
      expect(offColor === undefined ? [] : readChannels(offColor)).toEqual([100, 100, 100]);
    });
  });

  describe('shader patch', () => {
    it('declares the delay attribute and the intensity in the vertex shader', () => {
      const registry = createWorldGlowMaterialRegistry(createPalette(FIRST_COLORS));
      const { vertexShader } = compile(registry.get({ key: 'road', kind: 'nightOpaque', offKey: 'plaza' }));

      expect(WORLD_GLOW_DELAY_ATTRIBUTE).toBe('glowDelay');
      expect(vertexShader).toContain(`attribute float ${WORLD_GLOW_DELAY_ATTRIBUTE};`);
      expect(vertexShader).toContain(`uniform float ${GLOW_DAY_NIGHT_UNIFORM};`);
      expect(vertexShader).toContain(`varying float ${GLOW_INTENSITY_VARYING};`);
      expect(vertexShader).toContain(
        [
          `${GLOW_INTENSITY_VARYING} = smoothstep(${WORLD_GLOW_DELAY_ATTRIBUTE}, `,
          `${WORLD_GLOW_DELAY_ATTRIBUTE} + ${WORLD_GLOW_RAMP.toFixed(4)}, ${GLOW_DAY_NIGHT_UNIFORM});`,
        ].join(''),
      );
    });

    it('finds every insertion point and keeps the original chunks', () => {
      const registry = createWorldGlowMaterialRegistry(createPalette(FIRST_COLORS));
      const opaque = compile(registry.get({ key: 'road', kind: 'nightOpaque', offKey: 'plaza' }));
      const additive = compile(registry.get({ key: 'road', kind: 'nightAdditive', strength: 0.5 }));

      [opaque, additive].forEach((shader) => {
        expect(shader.vertexShader).toContain(GLOW_COMMON_ANCHOR);
        expect(shader.vertexShader).toContain(GLOW_BEGIN_VERTEX_ANCHOR);
        expect(shader.fragmentShader).toContain(GLOW_COMMON_ANCHOR);
        expect(shader.fragmentShader.indexOf(`varying float ${GLOW_INTENSITY_VARYING};`))
          .toBeGreaterThan(shader.fragmentShader.indexOf(GLOW_COMMON_ANCHOR));
        expect(shader.vertexShader.indexOf(`${GLOW_INTENSITY_VARYING} = smoothstep(`))
          .toBeGreaterThan(shader.vertexShader.indexOf(GLOW_BEGIN_VERTEX_ANCHOR));
      });

      expect(opaque.fragmentShader.indexOf('diffuseColor.rgb = mix('))
        .toBeGreaterThan(opaque.fragmentShader.indexOf(GLOW_COLOR_FRAGMENT_ANCHOR));
      expect(additive.fragmentShader.indexOf('gl_FragColor.rgb *='))
        .toBeGreaterThan(additive.fragmentShader.indexOf(GLOW_COLORSPACE_FRAGMENT_ANCHOR));
    });

    it('patches each include exactly once', () => {
      const registry = createWorldGlowMaterialRegistry(createPalette(FIRST_COLORS));
      const opaqueMaterial = registry.get({ key: 'road', kind: 'nightOpaque', offKey: 'plaza' });
      const { fragmentShader, vertexShader } = compile(opaqueMaterial);

      expect(vertexShader.split(`attribute float ${WORLD_GLOW_DELAY_ATTRIBUTE};`)).toHaveLength(2);
      expect(fragmentShader.split(`uniform vec3 ${GLOW_OFF_COLOR_UNIFORM};`)).toHaveLength(2);
    });

    it('separates programs by kind and shares them inside a kind', () => {
      const registry = createWorldGlowMaterialRegistry(createPalette(FIRST_COLORS));
      const opaque = registry.get({ key: 'road', kind: 'nightOpaque', offKey: 'plaza' });
      const otherOpaque = registry.get({ key: 'plaza', kind: 'nightOpaque', offKey: 'road' });
      const additive = registry.get({ key: 'road', kind: 'nightAdditive', strength: 0.5 });
      const otherAdditive = registry.get({ key: 'road', kind: 'nightAdditive', strength: 0.9 });

      expect(opaque.customProgramCacheKey()).toBe(GLOW_OPAQUE_PROGRAM_KEY);
      expect(additive.customProgramCacheKey()).toBe(GLOW_ADDITIVE_PROGRAM_KEY);
      expect(opaque.customProgramCacheKey()).not.toBe(additive.customProgramCacheKey());
      expect(otherOpaque.customProgramCacheKey()).toBe(opaque.customProgramCacheKey());
      expect(otherAdditive.customProgramCacheKey()).toBe(additive.customProgramCacheKey());
    });

    it('gives one value object to every compiled material', () => {
      const registry = createWorldGlowMaterialRegistry(createPalette(FIRST_COLORS));
      const first = compile(registry.get({ key: 'road', kind: 'nightOpaque', offKey: 'plaza' }));
      const second = compile(registry.get({ key: 'plaza', kind: 'nightAdditive', strength: 0.5 }));

      expect(first.uniforms[GLOW_DAY_NIGHT_UNIFORM]).toBe(second.uniforms[GLOW_DAY_NIGHT_UNIFORM]);

      registry.applyDayNight(0.7);

      expect(first.uniforms[GLOW_DAY_NIGHT_UNIFORM]?.value).toBe(0.7);
      expect(second.uniforms[GLOW_DAY_NIGHT_UNIFORM]?.value).toBe(0.7);
    });
  });

  describe('applyDayNight', () => {
    it('starts at day and writes the value into the shared object', () => {
      const registry = createWorldGlowMaterialRegistry(createPalette(FIRST_COLORS));

      expect(registry.dayNight.value).toBe(0);

      registry.applyDayNight(0.4);

      expect(registry.dayNight.value).toBe(0.4);
    });

    it('clamps the value to 0..1', () => {
      const registry = createWorldGlowMaterialRegistry(createPalette(FIRST_COLORS));

      registry.applyDayNight(1.8);
      expect(registry.dayNight.value).toBe(1);

      registry.applyDayNight(-0.3);
      expect(registry.dayNight.value).toBe(0);
    });

    it('keeps the same value object for the whole life of the registry', () => {
      const registry = createWorldGlowMaterialRegistry(createPalette(FIRST_COLORS));
      const { dayNight } = registry;

      registry.applyDayNight(0.5);
      registry.applyPalette(createPalette(SECOND_COLORS));

      expect(registry.dayNight).toBe(dayNight);
    });
  });

  describe('dispose', () => {
    it('disposes every created material once', () => {
      const registry = createWorldGlowMaterialRegistry(createPalette(FIRST_COLORS));
      const materials = [
        registry.get({ key: 'road', kind: 'unlit' }),
        registry.get({ key: 'road', kind: 'nightOpaque', offKey: 'plaza' }),
        registry.get({ key: 'road', kind: 'nightAdditive', strength: 0.5 }),
      ];
      const spies = materials.map(material => vi.spyOn(material, 'dispose'));

      registry.dispose();

      spies.forEach((spy) => {
        expect(spy).toHaveBeenCalledTimes(1);
      });
    });
  });
});
