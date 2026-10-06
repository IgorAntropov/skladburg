export const createCleanEnvironment = (): NodeJS.ProcessEnv => {
  const environment: NodeJS.ProcessEnv = {};

  for (const [name, value] of Object.entries(process.env)) {
    if (!name.startsWith('GIT_')) {
      environment[name] = value;
    }
  }

  environment.GIT_CONFIG_GLOBAL = '/dev/null';
  environment.GIT_CONFIG_NOSYSTEM = '1';

  return environment;
};
