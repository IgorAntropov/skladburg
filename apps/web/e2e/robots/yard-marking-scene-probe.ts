import type { Page } from '@playwright/test';

export interface YardMarkingSceneProbeValue {
  instance: number[];
  lastFrameDrawCalls: number;
  markedDraws: number;
  markedPoses: { cell: number; position: number[] }[];
  markedTruckInstances: number;
  modelView: number[];
  projection: number[];
}

export interface YardPlateCornersValue {
  bottomLeft: YardScreenPointValue;
  topLeft: YardScreenPointValue;
  topRight: YardScreenPointValue;
}

export type YardPlateFaceValue = 'front' | 'rear';

export interface YardScreenPointValue {
  x: number;
  y: number;
}

const PLATE_WIDTH_METERS = 1.16;
const PLATE_HEIGHT_METERS = 0.29;
const PLATE_MOUNTS = {
  front: { direction: -1, height: 0.208, z: -3.06 },
  rear: { direction: 1, height: 0.275, z: 2.945 },
} as const;

export const installYardMarkingSceneProbe = (hasPoseHistory: boolean): void => {
  const probe: YardMarkingSceneProbeValue = {
    instance: [], lastFrameDrawCalls: 0, markedDraws: 0, markedPoses: [], markedTruckInstances: 0, modelView: [], projection: [],
  };
  Object.defineProperty(window, '__yardMarkingSceneProbe', { value: probe });
  const prototype = WebGL2RenderingContext.prototype;
  const original = Object.create(null, Object.getOwnPropertyDescriptors(prototype)) as WebGL2RenderingContext;
  const offscreen = new WeakMap<WebGL2RenderingContext, boolean>();
  const modelLocations = new WeakMap<WebGLProgram, WebGLUniformLocation>();
  const instanceMatrices = new WeakMap<WebGLBuffer, number[]>();
  const projectionLocations = new WeakSet<WebGLUniformLocation>();
  const markedPrograms = new WeakMap<WebGLProgram, boolean>();
  let isInFrame = false;
  let currentCalls = 0;
  let currentMarkedDraws = 0;
  let currentMarkedTruckInstances = 0;

  const readAttribute = (gl: WebGL2RenderingContext, program: WebGLProgram, attribute: string, length: number): number[] => {
    const slot = gl.getAttribLocation(program, attribute);
    if (slot < 0) {
      return [];
    }
    const instanceBuffer: unknown = gl.getVertexAttrib(slot, gl.VERTEX_ATTRIB_ARRAY_BUFFER_BINDING);
    if (!(instanceBuffer instanceof WebGLBuffer)) {
      return [];
    }
    const isMatrix = attribute === 'instanceMatrix';
    const cached = isMatrix ? instanceMatrices.get(instanceBuffer) : undefined;
    if (cached !== undefined) {
      return cached;
    }
    const previousBuffer: unknown = gl.getParameter(gl.ARRAY_BUFFER_BINDING);
    const offset = gl.getVertexAttribOffset(slot, gl.VERTEX_ATTRIB_ARRAY_POINTER);
    const data = new Float32Array(length);
    gl.bindBuffer(gl.ARRAY_BUFFER, instanceBuffer);
    gl.getBufferSubData(gl.ARRAY_BUFFER, offset, data);
    gl.bindBuffer(gl.ARRAY_BUFFER, previousBuffer instanceof WebGLBuffer ? previousBuffer : null);
    const elements = Array.from(data);
    if (isMatrix) {
      instanceMatrices.set(instanceBuffer, elements);
    }
    return elements;
  };

  const countDraw = (): void => {
    if (!isInFrame) {
      isInFrame = true;
      currentCalls = 0;
      currentMarkedDraws = 0;
      currentMarkedTruckInstances = 0;
      queueMicrotask(() => {
        probe.lastFrameDrawCalls = currentCalls;
        probe.markedDraws = currentMarkedDraws;
        probe.markedTruckInstances = currentMarkedTruckInstances;
        isInFrame = false;
      });
    }
    currentCalls += 1;
  };

  prototype.bindFramebuffer = function (this: WebGL2RenderingContext, target, framebuffer): void {
    original.bindFramebuffer.call(this, target, framebuffer);
    if (target === this.FRAMEBUFFER || target === this.DRAW_FRAMEBUFFER) {
      offscreen.set(this, framebuffer !== null);
    }
  };
  prototype.getUniformLocation = function (this: WebGL2RenderingContext, program, name): null | WebGLUniformLocation {
    const location = original.getUniformLocation.call(this, program, name);
    if (location === null) {
      return location;
    }
    if (name === 'projectionMatrix') {
      projectionLocations.add(location);
    }
    else if (name === 'modelViewMatrix') {
      modelLocations.set(program, location);
    }
    return location;
  };
  prototype.uniformMatrix4fv = function (this: WebGL2RenderingContext, location, transpose, data, offset, length): void {
    original.uniformMatrix4fv.call(this, location, transpose, data, offset, length);
    if (location !== null && projectionLocations.has(location) && offscreen.get(this) !== true) {
      const start = offset ?? 0;
      const values = Array.from(data).slice(start, start + 16);
      if (values.length === 16) {
        probe.projection = values;
      }
    }
  };
  prototype.drawArrays = function (this: WebGL2RenderingContext, ...args): void {
    countDraw();
    original.drawArrays.apply(this, args);
  };
  prototype.drawArraysInstanced = function (this: WebGL2RenderingContext, ...args): void {
    countDraw();
    original.drawArraysInstanced.apply(this, args);
  };
  prototype.drawElements = function (this: WebGL2RenderingContext, ...args): void {
    countDraw();
    original.drawElements.apply(this, args);
  };
  prototype.drawElementsInstanced = function (this: WebGL2RenderingContext, mode, count, type, offset, instanceCount): void {
    countDraw();
    if (count === 4_158 && instanceCount > 0 && offscreen.get(this) !== true) {
      const program: unknown = this.getParameter(this.CURRENT_PROGRAM);
      if (program instanceof WebGLProgram) {
        const isMarked = markedPrograms.get(program) ?? this.getAttribLocation(program, 'yardMarkingUv') !== -1;
        markedPrograms.set(program, isMarked);
        if (isMarked) {
          currentMarkedDraws += 1;
          currentMarkedTruckInstances += instanceCount;
          const modelLocation = modelLocations.get(program);
          if (instanceCount === 1 && modelLocation !== undefined) {
            const model: unknown = this.getUniform(program, modelLocation);
            if (model instanceof Float32Array) {
              probe.modelView = Array.from(model);
              probe.instance = readAttribute(this, program, 'instanceMatrix', 16);
              if (hasPoseHistory) {
                const [cell] = readAttribute(this, program, 'instanceColor', 1);
                if (cell !== undefined) {
                  const position = [...probe.modelView.slice(12, 15), ...probe.instance.slice(12, 15)];
                  probe.markedPoses.push({ cell, position });
                }
              }
            }
          }
        }
      }
    }
    original.drawElementsInstanced.call(this, mode, count, type, offset, instanceCount);
  };
};

export const readYardMarkingSceneProbe = (page: Page): Promise<YardMarkingSceneProbeValue> =>
  page.evaluate<YardMarkingSceneProbeValue>('window.__yardMarkingSceneProbe');

type Point4Value = readonly [number, number, number, number];

const transformPoint = (matrix: readonly number[], [x, y, z, w]: Point4Value): Point4Value => {
  const row = (index: number): number =>
    (matrix[index] ?? 0) * x + (matrix[index + 4] ?? 0) * y + (matrix[index + 8] ?? 0) * z + (matrix[index + 12] ?? 0) * w;
  return [row(0), row(1), row(2), row(3)];
};

export const projectYardPlateCorners = (
  { instance, modelView, projection }: YardMarkingSceneProbeValue,
  face: YardPlateFaceValue,
  canvasWidth: number,
  canvasHeight: number,
): YardPlateCornersValue => {
  const { direction, height, z } = PLATE_MOUNTS[face];
  const left = -direction * PLATE_WIDTH_METERS / 2;
  const top = height + PLATE_HEIGHT_METERS / 2;
  const bottom = height - PLATE_HEIGHT_METERS / 2;
  const project = (x: number, y: number): YardScreenPointValue => {
    const local = transformPoint(instance, [x, y, z, 1]);
    const [cx, cy, , w] = transformPoint(projection, transformPoint(modelView, local));
    return { x: canvasWidth * (1 + cx / w) / 2, y: canvasHeight * (1 - cy / w) / 2 };
  };
  return { bottomLeft: project(left, bottom), topLeft: project(left, top), topRight: project(-left, top) };
};

export const readYardZoomCssPx = ({ projection }: YardMarkingSceneProbeValue, canvasWidth: number): number =>
  Math.abs(projection[0] ?? 0) * canvasWidth / 2;
