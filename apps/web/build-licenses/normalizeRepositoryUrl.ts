const GIT_PLUS_PREFIX_PATTERN = /^git\+/;

const GIT_PROTOCOL_PATTERN = /^git:\/\//;

const SSH_PATTERN = /^(?:git\+)?(?:ssh:\/\/)?git@([^:/\s]+)[:/](.+)$/;

const GIT_SUFFIX_PATTERN = /\.git$/;

const HOSTED_SHORTCUT_PATTERN = /^(github|gitlab|bitbucket):([^/\s]+\/[^/\s]+)$/;

const OWNER_REPOSITORY_PATTERN = /^[\w.-]+\/[\w.-]+$/;

const HOSTS_BY_SHORTCUT: ReadonlyMap<string, string> = new Map([
  ['bitbucket', 'bitbucket.org'],
  ['github', 'github.com'],
  ['gitlab', 'gitlab.com'],
]);

const trimGitSuffix = (url: string): string => url.replace(GIT_SUFFIX_PATTERN, '');

export const normalizeRepositoryUrl = (repository: unknown): string | undefined => {
  const rawUrl = typeof repository === 'object' && repository !== null && 'url' in repository ? repository.url : repository;

  if (typeof rawUrl !== 'string') {
    return undefined;
  }

  const url = rawUrl.trim();

  if (url === '') {
    return undefined;
  }

  const [, shortcutName, shortcutPath] = HOSTED_SHORTCUT_PATTERN.exec(url) ?? [];
  const shortcutHost = shortcutName === undefined ? undefined : HOSTS_BY_SHORTCUT.get(shortcutName);

  if (shortcutHost !== undefined && shortcutPath !== undefined) {
    return `https://${shortcutHost}/${trimGitSuffix(shortcutPath)}`;
  }

  const [, sshHost, sshPath] = SSH_PATTERN.exec(url) ?? [];

  if (sshHost !== undefined && sshPath !== undefined) {
    return `https://${sshHost}/${trimGitSuffix(sshPath)}`;
  }

  if (OWNER_REPOSITORY_PATTERN.test(url)) {
    return `https://github.com/${trimGitSuffix(url)}`;
  }

  return trimGitSuffix(url.replace(GIT_PLUS_PREFIX_PATTERN, '').replace(GIT_PROTOCOL_PATTERN, 'https://'));
};
