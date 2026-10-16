import type {
  NetworkConditionsValue,
  PerfProfileValue,
  PerfViewportValue,
} from './perfTypes.ts';

const BITS_PER_BYTE = 8;
const BITS_PER_MEGABIT = 1_000_000;
const BITS_PER_KIBIBIT = 1024;
const DEVTOOLS_THROUGHPUT_FACTOR = 0.9;

const FAST_4G_NETWORK: NetworkConditionsValue = {
  downloadBytesPerSecond: 9 * BITS_PER_MEGABIT / BITS_PER_BYTE * DEVTOOLS_THROUGHPUT_FACTOR,
  latencyMs: 165,
  uploadBytesPerSecond: 1.5 * BITS_PER_MEGABIT / BITS_PER_BYTE * DEVTOOLS_THROUGHPUT_FACTOR,
};

const SLOW_4G_NETWORK: NetworkConditionsValue = {
  downloadBytesPerSecond: Math.floor(1474.56 * BITS_PER_KIBIBIT / BITS_PER_BYTE),
  latencyMs: 562.5,
  uploadBytesPerSecond: Math.floor(675 * BITS_PER_KIBIBIT / BITS_PER_BYTE),
};

const MOBILE_VIEWPORT: PerfViewportValue = {
  deviceScaleFactor: 1.75,
  hasTouch: true,
  height: 823,
  isMobile: true,
  width: 412,
};

const DESKTOP_VIEWPORT: PerfViewportValue = {
  deviceScaleFactor: 1,
  hasTouch: false,
  height: 900,
  isMobile: false,
  width: 1440,
};

const MOBILE_CPU_RATE = 4;

export const PERF_PROFILES: readonly PerfProfileValue[] = [
  {
    cpuRate: MOBILE_CPU_RATE,
    isSceneTracked: false,
    name: 'mobile-fast-4g',
    network: FAST_4G_NETWORK,
    viewport: MOBILE_VIEWPORT,
  },
  {
    cpuRate: MOBILE_CPU_RATE,
    isSceneTracked: false,
    name: 'mobile-slow-4g',
    network: SLOW_4G_NETWORK,
    viewport: MOBILE_VIEWPORT,
  },
  {
    cpuRate: 1,
    isSceneTracked: true,
    name: 'desktop-fast-4g',
    network: FAST_4G_NETWORK,
    viewport: DESKTOP_VIEWPORT,
  },
];

export const selectPerfProfiles = (names: readonly string[] | undefined): PerfProfileValue[] => {
  if (names === undefined) {
    return [...PERF_PROFILES];
  }

  return names.map((name) => {
    const profile = PERF_PROFILES.find(candidate => candidate.name === name);

    if (profile === undefined) {
      const knownNames = PERF_PROFILES.map(candidate => candidate.name).join(', ');

      throw new Error(`Unknown perf profile "${name}"; known profiles: ${knownNames}`);
    }

    return profile;
  });
};
