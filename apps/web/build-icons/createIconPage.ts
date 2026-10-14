export const createIconPage = (svgSource: string, size: number): string => {
  const dimension = String(size);
  const dataUrl = `data:image/svg+xml;base64,${Buffer.from(svgSource, 'utf8').toString('base64')}`;

  return [
    '<!doctype html>',
    '<html>',
    '<head><meta charset="utf-8"><style>html,body{margin:0;padding:0;background:transparent}img{display:block}</style></head>',
    `<body><img alt="" src="${dataUrl}" width="${dimension}" height="${dimension}"></body>`,
    '</html>',
  ].join('');
};
