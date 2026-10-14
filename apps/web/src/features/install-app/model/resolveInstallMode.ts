import type {
  InstallEnvironmentValue,
  InstallModeValue,
} from './installTypes';

const IOS_USER_AGENT_PATTERN = /iPhone|iPad|iPod/;

const MAC_USER_AGENT_MARKER = 'Macintosh';

const MIN_TABLET_TOUCH_POINTS = 2;

const isIosFamily = ({ maxTouchPoints, userAgent }: InstallEnvironmentValue): boolean => {
  const isIosUserAgent = IOS_USER_AGENT_PATTERN.test(userAgent);
  const isTabletInDesktopMode = userAgent.includes(MAC_USER_AGENT_MARKER) && maxTouchPoints >= MIN_TABLET_TOUCH_POINTS;

  return isIosUserAgent || isTabletInDesktopMode;
};

export const resolveInstallMode = (environment: InstallEnvironmentValue): InstallModeValue => {
  if (environment.isStandalone) {
    return 'installed';
  }

  if (isIosFamily(environment)) {
    return 'instructions';
  }

  return environment.hasDeferredPrompt ? 'prompt' : 'unavailable';
};
