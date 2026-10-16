import { execFileSync } from 'node:child_process';
import {
  createHash,
  X509Certificate,
} from 'node:crypto';
import {
  existsSync,
  mkdirSync,
} from 'node:fs';
import { join } from 'node:path';

import {
  DEV_HTTPS_CERT_FILE_VARIABLE,
  DEV_HTTPS_KEY_FILE_VARIABLE,
} from '../build-dev-https/resolveDevHttps.ts';

export type PerfTlsEnvValue = Readonly<Record<string, string | undefined>>;

export interface PerfTlsFilesValue {
  certFile: string;
  keyFile: string;
}

export type PerfTlsPlanValue = { files: PerfTlsFilesValue; kind: 'environment' } | { kind: 'generate' };

export interface PerfTlsToolsValue {
  hasFile: (path: string) => boolean;
  makeDirectory: (path: string) => void;
  runOpenssl: (args: string[]) => void;
}

export interface ResolvePerfTlsInputValue {
  directory: string;
  env: PerfTlsEnvValue;
  tools?: PerfTlsToolsValue;
}

const CERT_FILE_NAME = 'perf-preview.pem';
const KEY_FILE_NAME = 'perf-preview-key.pem';
const CERT_VALIDITY_DAYS = '30';
const OPENSSL_COMMAND = 'openssl';

const DEFAULT_TOOLS: PerfTlsToolsValue = {
  hasFile: existsSync,
  makeDirectory(path: string): void {
    mkdirSync(path, { recursive: true });
  },
  runOpenssl(args: string[]): void {
    execFileSync(OPENSSL_COMMAND, args, { stdio: 'pipe' });
  },
};

const readVariable = (env: PerfTlsEnvValue, name: string): string | undefined => {
  const value = env[name]?.trim();

  return value === undefined || value === '' ? undefined : value;
};

export const planPerfTls = (env: PerfTlsEnvValue): PerfTlsPlanValue => {
  const certFile = readVariable(env, DEV_HTTPS_CERT_FILE_VARIABLE);
  const keyFile = readVariable(env, DEV_HTTPS_KEY_FILE_VARIABLE);

  if (certFile === undefined && keyFile === undefined) {
    return { kind: 'generate' };
  }

  if (certFile === undefined || keyFile === undefined) {
    const missing = certFile === undefined ? DEV_HTTPS_CERT_FILE_VARIABLE : DEV_HTTPS_KEY_FILE_VARIABLE;
    const present = certFile === undefined ? DEV_HTTPS_KEY_FILE_VARIABLE : DEV_HTTPS_CERT_FILE_VARIABLE;

    throw new Error(`${missing} is required when ${present} is set`);
  }

  return { files: { certFile, keyFile }, kind: 'environment' };
};

export const buildOpensslArguments = ({ certFile, keyFile }: PerfTlsFilesValue): string[] => [
  'req',
  '-x509',
  '-newkey',
  'rsa:2048',
  '-nodes',
  '-keyout',
  keyFile,
  '-out',
  certFile,
  '-days',
  CERT_VALIDITY_DAYS,
  '-subj',
  '/CN=localhost',
];

const isMissingCommandError = (error: unknown): boolean => (
  error instanceof Error && 'code' in error && error.code === 'ENOENT'
);

const generateSelfSignedFiles = (directory: string, tools: PerfTlsToolsValue): PerfTlsFilesValue => {
  const files: PerfTlsFilesValue = { certFile: join(directory, CERT_FILE_NAME), keyFile: join(directory, KEY_FILE_NAME) };

  if (tools.hasFile(files.certFile) && tools.hasFile(files.keyFile)) {
    return files;
  }

  tools.makeDirectory(directory);

  try {
    tools.runOpenssl(buildOpensslArguments(files));
  }
  catch (error) {
    const reason = isMissingCommandError(error)
      ? `the "${OPENSSL_COMMAND}" command is not installed`
      : `"${OPENSSL_COMMAND}" failed: ${String(error)}`;

    throw new Error(
      `The HTTP/2 preview needs a certificate and ${reason}. `
      + `Install openssl, set ${DEV_HTTPS_CERT_FILE_VARIABLE} and ${DEV_HTTPS_KEY_FILE_VARIABLE} (README, mkcert), `
      + 'or run the measurement with PERF_PREVIEW_PROTOCOL=h1.',
      { cause: error },
    );
  }

  return files;
};

export const buildSpkiTrustArgument = (certificatePem: Buffer | string): string => {
  const publicKey = new X509Certificate(certificatePem).publicKey.export({ format: 'der', type: 'spki' });
  const spkiHash = createHash('sha256').update(publicKey).digest('base64');

  return `--ignore-certificate-errors-spki-list=${spkiHash}`;
};

export const resolvePerfTls = ({ directory, env, tools = DEFAULT_TOOLS }: ResolvePerfTlsInputValue): PerfTlsFilesValue => {
  const plan = planPerfTls(env);

  return plan.kind === 'environment' ? plan.files : generateSelfSignedFiles(directory, tools);
};
