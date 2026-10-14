export const DEV_HTTPS_CERT_FILE_VARIABLE = 'DEV_HTTPS_CERT_FILE';

export const DEV_HTTPS_KEY_FILE_VARIABLE = 'DEV_HTTPS_KEY_FILE';

export const DEV_HTTPS_ENV_PREFIX = 'DEV_HTTPS_';

export interface DevHttpsValue {
  cert: Buffer;
  key: Buffer;
}

const readVariable = (env: Readonly<Record<string, string | undefined>>, name: string): string | undefined => {
  const value = env[name];

  return value === undefined || value === '' ? undefined : value;
};

const readCredentialFile = (
  readFile: (path: string) => Buffer,
  variableName: string,
  filePath: string,
): Buffer => {
  try {
    return readFile(filePath);
  }
  catch (error) {
    throw new Error(`${variableName} points to an unreadable file: ${filePath}`, { cause: error });
  }
};

export const resolveDevHttps = (
  env: Readonly<Record<string, string | undefined>>,
  readFile: (path: string) => Buffer,
): DevHttpsValue | undefined => {
  const certPath = readVariable(env, DEV_HTTPS_CERT_FILE_VARIABLE);
  const keyPath = readVariable(env, DEV_HTTPS_KEY_FILE_VARIABLE);

  if (certPath === undefined && keyPath === undefined) {
    return undefined;
  }

  if (certPath === undefined) {
    throw new Error(`${DEV_HTTPS_CERT_FILE_VARIABLE} is required when ${DEV_HTTPS_KEY_FILE_VARIABLE} is set`);
  }

  if (keyPath === undefined) {
    throw new Error(`${DEV_HTTPS_KEY_FILE_VARIABLE} is required when ${DEV_HTTPS_CERT_FILE_VARIABLE} is set`);
  }

  return {
    cert: readCredentialFile(readFile, DEV_HTTPS_CERT_FILE_VARIABLE, certPath),
    key: readCredentialFile(readFile, DEV_HTTPS_KEY_FILE_VARIABLE, keyPath),
  };
};
