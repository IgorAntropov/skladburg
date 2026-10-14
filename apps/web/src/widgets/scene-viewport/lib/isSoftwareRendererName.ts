const SOFTWARE_RENDERER_PATTERN = /swiftshader|llvmpipe|softpipe|software|basic render driver/i;

export const isSoftwareRendererName = (name: string): boolean => SOFTWARE_RENDERER_PATTERN.test(name);
