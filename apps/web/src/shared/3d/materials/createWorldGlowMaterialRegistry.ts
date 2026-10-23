import {
  AdditiveBlending,
  Color,
  MathUtils,
  MeshBasicMaterial,
} from 'three';

import type {
  WorldPaletteKeyValue,
  WorldPaletteValue,
} from '../palette/worldPaletteKeys';

import { applyRgbaColor } from '../world/applyRgbaColor';
import {
  GLOW_ADDITIVE_PROGRAM_KEY,
  GLOW_OPAQUE_PROGRAM_KEY,
  patchAdditiveGlowShader,
  patchOpaqueGlowShader,
} from './glowShader';

export const GLOW_VISIBLE_EPSILON = 0.001;

export interface DayNightUniformValue {
  value: number;
}

export interface IWorldGlowMaterialRegistry {
  applyDayNight: (value: number) => void;
  applyPalette: (palette: WorldPaletteValue) => void;
  dayNight: DayNightUniformValue;
  dispose: () => void;
  get: (spec: WorldGlowMaterialSpecValue) => MeshBasicMaterial;
}

export type WorldGlowMaterialSpecValue
  = | { key: WorldPaletteKeyValue; kind: 'nightAdditive'; strength: number }
    | { key: WorldPaletteKeyValue; kind: 'nightOpaque'; offKey: WorldPaletteKeyValue }
    | { key: WorldPaletteKeyValue; kind: 'unlit' };

interface GlowEntryValue {
  applyPalette: (palette: WorldPaletteValue) => void;
  material: MeshBasicMaterial;
}

const getSpecCacheKey = (spec: WorldGlowMaterialSpecValue): string => {
  switch (spec.kind) {
    case 'nightAdditive': {
      return `${spec.kind}:${spec.key}:${String(spec.strength)}`;
    }
    case 'nightOpaque': {
      return `${spec.kind}:${spec.key}:${spec.offKey}`;
    }
    case 'unlit': {
      return `${spec.kind}:${spec.key}`;
    }
  }
};

const createUnlitEntry = (key: WorldPaletteKeyValue): GlowEntryValue => {
  const material = new MeshBasicMaterial({ toneMapped: false });

  return {
    applyPalette: (palette): void => {
      applyRgbaColor(material.color, palette[key]);
    },
    material,
  };
};

const createOpaqueEntry = (
  key: WorldPaletteKeyValue,
  offKey: WorldPaletteKeyValue,
  dayNight: DayNightUniformValue,
): GlowEntryValue => {
  const material = new MeshBasicMaterial({ toneMapped: false });
  const offColor = { value: new Color() };

  material.onBeforeCompile = (shader): void => {
    patchOpaqueGlowShader(shader, dayNight, offColor);
  };
  material.customProgramCacheKey = (): string => GLOW_OPAQUE_PROGRAM_KEY;

  return {
    applyPalette: (palette): void => {
      applyRgbaColor(material.color, palette[key]);
      applyRgbaColor(offColor.value, palette[offKey]);
    },
    material,
  };
};

const createAdditiveEntry = (
  key: WorldPaletteKeyValue,
  strength: number,
  dayNight: DayNightUniformValue,
): GlowEntryValue => {
  const material = new MeshBasicMaterial({
    blending: AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
    transparent: true,
  });
  const strengthUniform = { value: strength };

  material.onBeforeCompile = (shader): void => {
    patchAdditiveGlowShader(shader, dayNight, strengthUniform);
  };
  material.customProgramCacheKey = (): string => GLOW_ADDITIVE_PROGRAM_KEY;
  material.visible = dayNight.value > GLOW_VISIBLE_EPSILON;

  return {
    applyPalette: (palette): void => {
      applyRgbaColor(material.color, palette[key]);
    },
    material,
  };
};

const createEntry = (spec: WorldGlowMaterialSpecValue, dayNight: DayNightUniformValue): GlowEntryValue => {
  switch (spec.kind) {
    case 'nightAdditive': {
      return createAdditiveEntry(spec.key, spec.strength, dayNight);
    }
    case 'nightOpaque': {
      return createOpaqueEntry(spec.key, spec.offKey, dayNight);
    }
    case 'unlit': {
      return createUnlitEntry(spec.key);
    }
  }
};

export const createWorldGlowMaterialRegistry = (initialPalette: WorldPaletteValue): IWorldGlowMaterialRegistry => {
  const entries = new Map<string, GlowEntryValue>();
  const additiveMaterials: MeshBasicMaterial[] = [];
  const dayNight: DayNightUniformValue = { value: 0 };
  let palette = initialPalette;

  const get = (spec: WorldGlowMaterialSpecValue): MeshBasicMaterial => {
    const cacheKey = getSpecCacheKey(spec);
    const existing = entries.get(cacheKey);

    if (existing !== undefined) {
      return existing.material;
    }

    const entry = createEntry(spec, dayNight);
    entry.applyPalette(palette);
    entries.set(cacheKey, entry);

    if (spec.kind === 'nightAdditive') {
      additiveMaterials.push(entry.material);
    }

    return entry.material;
  };

  const applyDayNight = (value: number): void => {
    dayNight.value = MathUtils.clamp(value, 0, 1);

    const isVisible = dayNight.value > GLOW_VISIBLE_EPSILON;

    for (const material of additiveMaterials) {
      material.visible = isVisible;
    }
  };

  const applyPalette = (nextPalette: WorldPaletteValue): void => {
    palette = nextPalette;
    entries.forEach((entry) => {
      entry.applyPalette(nextPalette);
    });
  };

  const dispose = (): void => {
    entries.forEach((entry) => {
      entry.material.dispose();
    });
  };

  return {
    applyDayNight,
    applyPalette,
    dayNight,
    dispose,
    get,
  };
};
