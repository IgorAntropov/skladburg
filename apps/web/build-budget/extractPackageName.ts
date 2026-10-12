const NODE_MODULES_SEGMENT = '/node_modules/';

const WINDOWS_SEPARATOR_PATTERN = /\\/g;

const stripQuery = (moduleId: string): string => {
  const queryStart = moduleId.indexOf('?');

  return queryStart === -1 ? moduleId : moduleId.slice(0, queryStart);
};

export const extractPackageName = (moduleId: string): string | undefined => {
  const normalizedId = `/${stripQuery(moduleId.replaceAll(WINDOWS_SEPARATOR_PATTERN, '/'))}`;
  const segmentStart = normalizedId.lastIndexOf(NODE_MODULES_SEGMENT);

  if (segmentStart === -1) {
    return undefined;
  }

  const [first, second] = normalizedId.slice(segmentStart + NODE_MODULES_SEGMENT.length).split('/');

  if (first === undefined || first === '') {
    return undefined;
  }

  if (!first.startsWith('@')) {
    return first;
  }

  return second === undefined || second === '' ? undefined : `${first}/${second}`;
};
