import {
  afterEach,
  describe,
  expect,
  it,
} from 'vitest';

import { createCleanEnvironment } from './clean-environment.ts';

const gitVariableNames = ['GIT_INDEX_FILE', 'GIT_DIR', 'GIT_WORK_TREE', 'GIT_AUTHOR_NAME', 'GIT_CONFIG_GLOBAL', 'GIT_CONFIG_NOSYSTEM'];
const keptVariableName = 'SKLADBURG_TOOL_TEST_KEPT';

describe('createCleanEnvironment', () => {
  afterEach(() => {
    for (const name of [...gitVariableNames, keptVariableName]) {
      Reflect.deleteProperty(process.env, name);
    }
  });

  it('removes every variable that starts with GIT_', () => {
    for (const name of gitVariableNames) {
      process.env[name] = 'value';
    }

    const environment = createCleanEnvironment();

    expect(Object.keys(environment).filter(name => name.startsWith('GIT_')).sort()).toEqual([
      'GIT_CONFIG_GLOBAL',
      'GIT_CONFIG_NOSYSTEM',
    ]);
  });

  it('disables the global and system git configuration', () => {
    process.env.GIT_CONFIG_GLOBAL = '/some/global/config';
    process.env.GIT_CONFIG_NOSYSTEM = '0';

    const environment = createCleanEnvironment();

    expect(environment.GIT_CONFIG_GLOBAL).toBe('/dev/null');
    expect(environment.GIT_CONFIG_NOSYSTEM).toBe('1');
  });

  it('keeps variables that do not start with GIT_', () => {
    process.env[keptVariableName] = 'kept';

    expect(createCleanEnvironment()[keptVariableName]).toBe('kept');
  });

  it('does not change the environment of the current process', () => {
    process.env.GIT_INDEX_FILE = 'index';

    createCleanEnvironment();

    expect(process.env.GIT_INDEX_FILE).toBe('index');
  });
});
