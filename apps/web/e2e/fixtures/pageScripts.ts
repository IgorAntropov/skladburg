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

export const SETTLE_FINITE_ANIMATIONS = [
  '(async () => {',
  'const isFinite = (animation) => animation.effect !== null && animation.effect.getComputedTiming().iterations !== Infinity;',
  'const finite = document.getAnimations().filter(isFinite);',
  'await Promise.all(finite.map((animation) => animation.finished.catch(() => undefined)));',
  'return finite.length;',
  '})()',
].join(' ');

export const READ_RUNNING_ANIMATION_COUNT = '(() => document.getAnimations().length)()';

export const INSTALL_ANIMATION_START_RECORDER = [
  '(() => {',
  'const names = [];',
  'document.addEventListener("animationstart", (event) => { names.push(event.animationName); }, true);',
  'window.startedAnimationNames = names;',
  '})()',
].join(' ');

export const READ_STARTED_ANIMATION_NAMES = '(() => [...window.startedAnimationNames])()';

export const INSTALL_ENGINE_GATE = [
  '(() => {',
  'const rules = new Map();',
  'const held = [];',
  'const originalPostMessage = Worker.prototype.postMessage;',
  'Worker.prototype.postMessage = function (message, transfer) {',
  'if (message !== null && typeof message === "object" && message.type === "control") {',
  'const mode = rules.get(message.command);',
  'if (mode === "hold") { held.push({ message, transfer, worker: this }); return; }',
  'if (mode === "fail") {',
  'const worker = this;',
  'const data = { requestId: message.requestId, type: "transport_error" };',
  'queueMicrotask(() => { worker.dispatchEvent(new MessageEvent("message", { data })); });',
  'return;',
  '}',
  '}',
  'return originalPostMessage.call(this, message, transfer);',
  '};',
  'window.engineGate = {',
  'heldCount: () => held.length,',
  'release: () => { for (const entry of held.splice(0)) { originalPostMessage.call(entry.worker, entry.message, entry.transfer); } },',
  'setMode: (command, mode) => { if (mode === "pass") { rules.delete(command); } else { rules.set(command, mode); } },',
  '};',
  '})()',
].join(' ');

export const createSetEngineGateModeScript = (command: string, mode: 'fail' | 'hold' | 'pass'): string => (
  `(() => { window.engineGate.setMode(${JSON.stringify(command)}, ${JSON.stringify(mode)}); })()`
);

export const RELEASE_ENGINE_GATE = '(() => { window.engineGate.release(); })()';

export const READ_HELD_ENGINE_MESSAGE_COUNT = '(() => window.engineGate.heldCount())()';

export const READ_FONTS_STATE = [
  '(async () => {',
  'await document.fonts.ready;',
  'const faces = [...document.fonts].map((face) => ({ family: face.family, status: face.status }));',
  'return {',
  'faces,',
  'isCyrillicLoaded: document.fonts.check("16px Manrope", "Ж"),',
  'isLatinLoaded: document.fonts.check("16px Manrope"),',
  'bodyFontFamily: getComputedStyle(document.body).fontFamily,',
  '};',
  '})()',
].join(' ');

const createReadElementScript = (selector: string, expression: string): string => [
  '(() => {',
  `const element = document.querySelector(${JSON.stringify(selector)});`,
  'if (element === null) { return null; }',
  `return ${expression};`,
  '})()',
].join(' ');

export const createReadOverflowScript = (selector: string): string => createReadElementScript(
  selector,
  'element.scrollHeight - element.clientHeight',
);

export const createReadScrollTopScript = (selector: string): string => createReadElementScript(selector, 'element.scrollTop');

export const createReadContainsFocusScript = (selector: string): string => createReadElementScript(
  selector,
  'element.contains(document.activeElement)',
);

export const createDelayEngineRequestScript = (urlPart: string, delayMs: number): string => [
  '(() => {',
  'const originalPostMessage = Worker.prototype.postMessage;',
  'Worker.prototype.postMessage = function (message, transfer) {',
  'const isDelayed = message !== null && typeof message === "object" && message.type === "request"',
  `&& typeof message.url === "string" && message.url.includes(${JSON.stringify(urlPart)});`,
  'if (isDelayed) {',
  'const worker = this;',
  `setTimeout(() => { originalPostMessage.call(worker, message, transfer); }, ${JSON.stringify(delayMs)});`,
  'return;',
  '}',
  'return originalPostMessage.call(this, message, transfer);',
  '};',
  '})()',
].join(' ');

export const INSTALL_SKELETON_RECORDER = [
  '(() => {',
  'let labels = {};',
  'let pageShownAt = null;',
  'const readLabel = (skeleton) => {',
  'const group = skeleton.closest("[role=status]");',
  'return group === null ? "" : (group.getAttribute("aria-label") ?? "");',
  '};',
  'const sample = () => {',
  'const now = performance.now();',
  'const current = new Map();',
  'for (const skeleton of document.querySelectorAll("[data-testid=hud-layout-skeleton]")) {',
  'current.set(readLabel(skeleton), getComputedStyle(skeleton).visibility);',
  '}',
  'for (const [label, visibility] of current) {',
  'if (labels[label] === undefined) {',
  'labels[label] = { firstSeenAt: now, firstSeenVisibility: visibility, visibleEndedAt: null, visibleStartedAt: null };',
  '}',
  'if (visibility === "visible" && labels[label].visibleStartedAt === null) { labels[label].visibleStartedAt = now; }',
  '}',
  'for (const [label, entry] of Object.entries(labels)) {',
  'const isVisible = current.get(label) === "visible";',
  'if (!isVisible && entry.visibleStartedAt !== null && entry.visibleEndedAt === null) { entry.visibleEndedAt = now; }',
  '}',
  'if (pageShownAt === null && document.querySelector("[data-testid=hud-zone-scene]") !== null) { pageShownAt = now; }',
  '};',
  'new MutationObserver(sample).observe(document, { attributeFilter: ["class"], attributes: true, childList: true, subtree: true });',
  'window.skeletonRecorder = {',
  'read: () => ({ labels: JSON.parse(JSON.stringify(labels)), pageShownAt }),',
  'reset: () => { labels = {}; pageShownAt = null; },',
  '};',
  '})()',
].join(' ');

export const READ_SKELETON_RECORD = '(() => window.skeletonRecorder.read())()';

export const RESET_SKELETON_RECORD = '(() => { window.skeletonRecorder.reset(); })()';

export const createReadHorizontalOverflowScript = (selector: string): string => createReadElementScript(
  selector,
  'element.scrollWidth - element.clientWidth',
);

export const createReadHeightsScript = (selector: string): string => (
  `(() => [...document.querySelectorAll(${JSON.stringify(selector)})].map((element) => element.getBoundingClientRect().height))()`
);
