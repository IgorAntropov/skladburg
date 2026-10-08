import { base64Decode } from '@bufbuild/protobuf/wire';
import {
  describe,
  expect,
  it,
} from 'vitest';

import { renderContractImageModule } from './renderContractImageModule';

const exportPattern = /^export const CONTRACT_IMAGE_BASE64 = '([A-Za-z0-9+/=]*)';\n$/;

describe('renderContractImageModule', () => {
  it('encodes the image so that decoding returns the same bytes', () => {
    const image = Uint8Array.from({ length: 1024 }, (_, index) => (index * 37 + 11) % 256);

    const match = exportPattern.exec(renderContractImageModule(image));

    expect(match).not.toBeNull();
    expect(base64Decode(match?.[1] ?? '')).toEqual(image);
  });

  it('renders a module with exactly one export and no comments', () => {
    const source = renderContractImageModule(Uint8Array.of(1, 2, 3));

    expect(source.match(/\bexport\b/g)).toHaveLength(1);
    expect(source).not.toMatch(/\/\/|\/\*/);
    expect(source.endsWith(';\n')).toBe(true);
  });

  it('renders an empty image as an empty literal', () => {
    expect(renderContractImageModule(new Uint8Array())).toBe('export const CONTRACT_IMAGE_BASE64 = \'\';\n');
  });
});
