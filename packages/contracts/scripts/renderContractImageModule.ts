export const renderContractImageModule = (image: Uint8Array): string =>
  `export const CONTRACT_IMAGE_BASE64 = '${Buffer.from(image).toString('base64')}';\n`;
