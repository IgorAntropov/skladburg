export const READ_HORIZONTAL_OVERFLOW = '(() => document.documentElement.scrollWidth - window.innerWidth)()';

export const createReadTokenColorScript = (tokenName: string): string => [
  '(() => {',
  'const probe = document.createElement("div");',
  `probe.style.backgroundColor = "var(${tokenName})";`,
  'document.documentElement.append(probe);',
  'const color = getComputedStyle(probe).backgroundColor;',
  'probe.remove();',
  'return color;',
  '})()',
].join(' ');

export const DISPATCH_RUSSIAN_LAYOUT_SLASH = [
  '(() => {',
  'document.body.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, cancelable: true, code: "Slash", key: "." }));',
  '})()',
].join(' ');

export const BLUR_ACTIVE_ELEMENT = [
  '(() => {',
  'const active = document.activeElement;',
  'if (active instanceof HTMLElement) { active.blur(); }',
  '})()',
].join(' ');

export const READ_IS_FOCUS_ON_BODY = '(() => document.activeElement === document.body || document.activeElement === null)()';

export const READ_VERTICAL_OVERFLOW = '(() => document.documentElement.scrollHeight - window.innerHeight)()';

export const createSetHashScript = (hash: string): string => `(() => { window.location.hash = ${JSON.stringify(hash)}; })()`;

export const createStoreThemeScript = (theme: string): string => [
  '(() => {',
  `window.localStorage.setItem("theme-preference", ${JSON.stringify(theme)});`,
  '})()',
].join(' ');

export const INSTALL_LONG_TASK_RECORDER = [
  '(() => {',
  'if (typeof PerformanceObserver === "undefined" || !PerformanceObserver.supportedEntryTypes.includes("longtask")) { return; }',
  'const durations = [];',
  'const observer = new PerformanceObserver((list) => { for (const entry of list.getEntries()) { durations.push(entry.duration); } });',
  'observer.observe({ type: "longtask", buffered: true });',
  'window.longTaskRecorder = { durations, observer };',
  '})()',
].join(' ');

export const READ_IS_LONG_TASK_RECORDER_INSTALLED = '(() => window.longTaskRecorder !== undefined)()';

export const TAKE_LONG_TASK_DURATIONS = [
  '(() => {',
  'const recorder = window.longTaskRecorder;',
  'if (recorder === undefined) { return []; }',
  'for (const entry of recorder.observer.takeRecords()) { recorder.durations.push(entry.duration); }',
  'return recorder.durations.splice(0);',
  '})()',
].join(' ');

export const createBlockMainThreadScript = (durationMs: number): string => [
  '(() => {',
  'setTimeout(() => {',
  `const end = performance.now() + ${JSON.stringify(durationMs)};`,
  'while (performance.now() < end) {}',
  '}, 0);',
  '})()',
].join(' ');

export const READ_LANDMARKS_HIDDEN_FROM_READERS = [
  '(() => {',
  'const landmarks = [...document.querySelectorAll("header, main, [role=banner], [role=main]")];',
  'return landmarks.filter((landmark) => landmark.closest("[aria-hidden=true]") !== null).length;',
  '})()',
].join(' ');

export const READ_PAGE_CLOCK_NOW = '(() => Date.now())()';

export const createReadWorldClockScript = (testId: string, timeZone: string): string => [
  '(() => {',
  `const group = document.querySelector("[data-testid=${testId}]");`,
  'const time = group === null ? null : group.querySelector("time");',
  'if (time === null) { return null; }',
  'const dateTime = time.getAttribute("datetime");',
  'if (dateTime === null) { return null; }',
  'const date = new Date(dateTime);',
  'const format = (zone) => new Intl.DateTimeFormat("ru", { hour: "2-digit", minute: "2-digit", timeZone: zone }).format(date);',
  `return { dateTime, expected: format(${JSON.stringify(timeZone)}), expectedUtc: format("UTC"), text: time.textContent };`,
  '})()',
].join(' ');
