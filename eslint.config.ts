import type { Linter } from 'eslint';

import js from '@eslint/js';
import stylistic from '@stylistic/eslint-plugin';
import perfectionist from 'eslint-plugin-perfectionist';
import reactHooks from 'eslint-plugin-react-hooks';
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';

import { localPlugin } from './scripts/eslint/local-plugin.ts';

const scriptFiles: string[] = ['**/*.{ts,tsx,mts,cts,js,jsx,mjs,cjs}'];
const plainScriptFiles: string[] = ['**/*.{js,jsx,mjs,cjs}'];
const engineCoreFiles: string[] = ['packages/demo-engine/src/core/**/*.ts'];
const engineBoundaryFiles: string[] = ['apps/web/src/**/*.{ts,tsx}'];
const engineBoundaryTestFiles: string[] = ['apps/web/src/**/*.test.{ts,tsx}'];
const engineBoundaryAllowedFiles: string[] = ['apps/web/src/shared/api/transport/demo/**'];
const engineBoundaryAllowedTestFiles: string[] = ['apps/web/src/shared/api/transport/demo/**/*.test.{ts,tsx}'];
const timeZoneExemptFiles: string[] = ['apps/web/src/shared/i18n/**/*.{ts,tsx}', 'apps/web/src/app/bootstrap/**/*.{ts,tsx}'];
const timeZoneExemptTestFiles: string[] = [
  'apps/web/src/shared/i18n/**/*.test.{ts,tsx}',
  'apps/web/src/app/bootstrap/**/*.test.{ts,tsx}',
];
const navigationOwnerFiles: string[] = ['apps/web/src/shared/routing/location/**/*.{ts,tsx}'];
const navigationOwnerTestFiles: string[] = ['apps/web/src/shared/routing/location/**/*.test.{ts,tsx}'];
const rawControlFiles: string[] = ['apps/web/src/**/*.tsx'];
const rawControlExemptFiles: string[] = ['apps/web/src/shared/ui/**', 'apps/web/src/**/*.test.tsx'];
const webTestFiles: string[] = ['apps/web/src/**/*.test.{ts,tsx}'];
const lazyAppFiles: string[] = ['apps/web/src/app/**/*.{ts,tsx}'];
const lazyWidgetFiles: string[] = ['apps/web/src/widgets/**/*.{ts,tsx}'];
const lazyProfileMenuFiles: string[] = ['apps/web/src/widgets/profile-menu/**/*.{ts,tsx}'];
const lazyProfileMenuChunkFiles: string[] = ['apps/web/src/widgets/profile-menu/ui/menu/**/*.{ts,tsx}'];
const motionSegmentFiles: string[] = ['apps/web/src/shared/lib/motion/**/*.{ts,tsx}'];
const motionSegmentTestFiles: string[] = ['apps/web/src/shared/lib/motion/**/*.test.{ts,tsx}'];
const lazyProfileMenuChunkTestFiles: string[] = ['apps/web/src/widgets/profile-menu/ui/menu/**/*.test.{ts,tsx}'];

interface BoundaryRestrictionValue {
  importPattern: string;
  message: string;
  selectorPattern: string;
}

const engineRestriction: BoundaryRestrictionValue = {
  importPattern: '^@skladburg/demo-engine(/|$)',
  message: 'The demo engine is reachable only through shared/api/transport/demo; take engine types from there',
  selectorPattern: '^@skladburg.demo-engine($|[^-a-z0-9_])',
};

const engineRestrictionForTests: BoundaryRestrictionValue = {
  ...engineRestriction,
  importPattern: '^@skladburg/demo-engine(?!/testing$)(/|$)',
  selectorPattern: '^@skladburg.demo-engine($|[^-a-z0-9_](?!testing$))',
};

const registryRestriction: BoundaryRestrictionValue = {
  importPattern: '^@skladburg/contracts/registry$',
  message: 'The contract registry is for the engine only; importing it here pulls the contract image into the initial bundle',
  selectorPattern: '^@skladburg.contracts.registry$',
};

const motionPackageRestriction: BoundaryRestrictionValue = {
  importPattern: '^motion(/|$)',
  message: 'The animation library is imported only inside shared/lib/motion; take MotionScope, m and AnimatePresence from it '
    + 'in the lazy chunk of the profile menu',
  selectorPattern: '^motion($|[^-a-z0-9_])',
};

const motionSegmentRestriction: BoundaryRestrictionValue = {
  importPattern: '^@/shared/lib/motion(/|$)',
  message: 'shared/lib/motion pulls the animation library into the bundle; use it only in the lazy chunk of the profile menu '
    + '(widgets/profile-menu/ui/menu) so that the initial bundle stays free of it',
  selectorPattern: '^@.shared.lib.motion($|[^-a-z0-9_])',
};

const motionRestrictions: BoundaryRestrictionValue[] = [motionPackageRestriction, motionSegmentRestriction];

const apiTestingEntryRestriction: BoundaryRestrictionValue = {
  importPattern: '^@/shared/api/index\\.testing$',
  message: 'The testing entry of shared/api is for tests only',
  selectorPattern: '^@.shared.api.index.testing$',
};

const routingTestingEntryRestriction: BoundaryRestrictionValue = {
  importPattern: '^@/shared/routing/index\\.testing$',
  message: 'The testing entry of shared/routing is for tests only',
  selectorPattern: '^@.shared.routing.index.testing$',
};

interface LazyModuleRestrictionValue {
  moduleLabel: string;
  regex: string;
}

const lazyModuleMessageSuffix = 'is loaded lazily through import(); a static value import pulls it into the initial bundle; '
  + 'use import type';

const personaSwitcherLazyRestriction: LazyModuleRestrictionValue = {
  moduleLabel: 'features/switch-persona',
  regex: '^@/features/switch-persona(/|$)',
};

const themeSwitcherLazyRestriction: LazyModuleRestrictionValue = {
  moduleLabel: 'features/switch-theme',
  regex: '^@/features/switch-theme(/|$)',
};

const demoResetLazyRestriction: LazyModuleRestrictionValue = {
  moduleLabel: 'features/reset-demo',
  regex: '^@/features/reset-demo(/|$)',
};

const sectionPagesLazyRestriction: LazyModuleRestrictionValue = {
  moduleLabel: 'pages/*',
  regex: '^@/pages(/|$)',
};

const profileMenuChunkLazyRestriction: LazyModuleRestrictionValue = {
  moduleLabel: 'the profile menu chunk',
  regex: '(^|/)menu(/|$)',
};

const appLazyRestrictions: LazyModuleRestrictionValue[] = [
  personaSwitcherLazyRestriction,
  themeSwitcherLazyRestriction,
  demoResetLazyRestriction,
  sectionPagesLazyRestriction,
];
const profileMenuLazyRestrictions: LazyModuleRestrictionValue[] = [...appLazyRestrictions, profileMenuChunkLazyRestriction];

interface SyntaxRestrictionValue {
  message: string;
  selector: string;
}

const createBoundaryRules = (
  restrictions: readonly BoundaryRestrictionValue[],
  extraSyntaxRestrictions: readonly SyntaxRestrictionValue[] = [],
): Linter.RulesRecord => ({
  'no-restricted-imports': [
    'error',
    { patterns: restrictions.map(({ importPattern, message }) => ({ message, regex: importPattern })) },
  ],
  'no-restricted-syntax': [
    'error',
    ...restrictions.flatMap(({ message, selectorPattern }) => [
      { message, selector: `ImportExpression[source.value=/${selectorPattern}/]` },
      { message, selector: `TSImportType[argument.literal.value=/${selectorPattern}/]` },
    ]),
    ...extraSyntaxRestrictions,
  ],
});

const createLazyModuleRules = (restrictions: readonly LazyModuleRestrictionValue[]): Linter.RulesRecord => ({
  '@typescript-eslint/no-restricted-imports': [
    'error',
    {
      patterns: restrictions.map(({ moduleLabel, regex }) => ({
        allowTypeImports: true,
        message: `${moduleLabel} ${lazyModuleMessageSuffix}`,
        regex,
      })),
    },
  ],
});

const createTimeZoneRestrictions = (hint: string): SyntaxRestrictionValue[] => [
  {
    message: `Local date getters and setters depend on the device time zone; ${hint}`,
    selector: 'MemberExpression[property.name=/^(get|set)(FullYear|Month|Date|Day|Hours|Minutes|Seconds|Milliseconds|Year)$/]',
  },
  {
    message: `getTimezoneOffset reads the device time zone; ${hint}`,
    selector: 'MemberExpression[property.name=\'getTimezoneOffset\']',
  },
  {
    message: `Local date formatting depends on the device time zone; ${hint}`,
    selector: 'MemberExpression[property.name=/^(toLocaleString|toLocaleDateString|toLocaleTimeString|toDateString|toTimeString)$/]',
  },
  {
    message: `new Date with date components builds a local time; ${hint}`,
    selector: 'NewExpression[callee.name=\'Date\'][arguments.length>=2]',
  },
  {
    message: `new Date with a string depends on the device time zone; ${hint}`,
    selector: 'NewExpression[callee.name=\'Date\'][arguments.0.value=type(string)]',
  },
  {
    message: `new Date with a template string depends on the device time zone; ${hint}`,
    selector: 'NewExpression[callee.name=\'Date\'][arguments.0.type=\'TemplateLiteral\']',
  },
  {
    message: `Date.parse depends on the device time zone; ${hint}`,
    selector: 'MemberExpression[object.name=\'Date\'][property.name=\'parse\']',
  },
  {
    message: `Intl.DateTimeFormat needs an explicit timeZone in an options literal; ${hint}`,
    selector: [
      ':matches(NewExpression, CallExpression)',
      '[callee.object.name=\'Intl\']',
      '[callee.property.name=\'DateTimeFormat\']',
      ':not(:has(> ObjectExpression:has(> Property[key.name=\'timeZone\'])))',
    ].join(''),
  },
  {
    message: `Temporal.Now reads the device time zone; ${hint}`,
    selector: 'MemberExpression[object.name=\'Temporal\'][property.name=\'Now\']',
  },
];

const createGlobalMatcher = (name: string, holders: string, path = 'object'): string =>
  `:matches([${path}.name='${name}'], [${path}.property.name='${name}'][${path}.object.name=/^(${holders})$/])`;

const createMemberNameMatcher = (members: string, path = 'property'): string =>
  `:matches([computed=false][${path}.name=/^(${members})$/], [computed=true][${path}.value=/^(${members})$/])`;

const createNavigationRestrictions = (): SyntaxRestrictionValue[] => {
  const locationHolders = 'window|globalThis|self|document|top|parent';
  const historyHolders = 'window|globalThis|self|top|parent';
  const locationMembers = 'hash|assign|replace|reload';
  const locationWrittenMembers = 'href|search|pathname';
  const historyMembers = 'pushState|replaceState|back|forward|go';

  return [
    {
      message: 'location.hash belongs to shared/routing; read the address with useAddress and change it with useNavigate or '
        + 'AddressLink, use @/shared/routing',
      selector: `MemberExpression${createMemberNameMatcher('hash')}${createGlobalMatcher('location', locationHolders)}`,
    },
    {
      message: 'Page navigation goes through shared/routing; do not call location.assign, location.replace or location.reload, '
        + 'use @/shared/routing (useNavigate, AddressLink, useReloadPage)',
      selector: `MemberExpression${createMemberNameMatcher('assign|replace|reload')}${createGlobalMatcher('location', locationHolders)}`,
    },
    {
      message: 'history.pushState, history.replaceState, history.back, history.forward and history.go belong to shared/routing; '
        + 'use @/shared/routing (useNavigate, AddressLink)',
      selector: `MemberExpression${createMemberNameMatcher(historyMembers)}${createGlobalMatcher('history', historyHolders)}`,
    },
    {
      message: 'Taking hash, assign, replace or reload out of location bypasses shared/routing, use @/shared/routing',
      selector: `VariableDeclarator${createGlobalMatcher('location', locationHolders, 'init')} > ObjectPattern > `
        + `Property[key.name=/^(${locationMembers})$/]`,
    },
    {
      message: 'Taking pushState, replaceState, back, forward or go out of history bypasses shared/routing, use @/shared/routing',
      selector: `VariableDeclarator${createGlobalMatcher('history', historyHolders, 'init')} > ObjectPattern > `
        + `Property[key.name=/^(${historyMembers})$/]`,
    },
    {
      message: 'Assigning to location navigates the page; use @/shared/routing (useNavigate, AddressLink)',
      selector: `AssignmentExpression${createGlobalMatcher('location', locationHolders, 'left')}`,
    },
    {
      message: 'Assigning to location.href, location.search or location.pathname navigates the page; use @/shared/routing '
        + '(useNavigate, AddressLink)',
      selector: `AssignmentExpression > MemberExpression.left${createMemberNameMatcher(locationWrittenMembers)}`
        + createGlobalMatcher('location', locationHolders),
    },
  ];
};

const navigationRestrictions: SyntaxRestrictionValue[] = createNavigationRestrictions();

const engineCoreTimeZoneRestrictions: SyntaxRestrictionValue[] = createTimeZoneRestrictions(
  'use getUTC*, Date.UTC, the functions of core/calendar or an explicit timeZone',
);
const webTimeZoneRestrictions: SyntaxRestrictionValue[] = createTimeZoneRestrictions(
  'format through shared/i18n, use getUTC* or Date.UTC, or pass an explicit timeZone',
);
const webSyntaxRestrictions: SyntaxRestrictionValue[] = [...webTimeZoneRestrictions, ...navigationRestrictions];

const sideEffectImportRestrictions: SyntaxRestrictionValue[] = [
  {
    message: 'Side-effect imports are dropped from the production build by sideEffects in apps/web/package.json; '
      + 'export a function and call it from the entry point',
    selector: 'ImportDeclaration[specifiers.length=0][importKind!=\'type\']:not([source.value=/\\.css$/])',
  },
];

const webSourceSyntaxRestrictions: SyntaxRestrictionValue[] = [...webSyntaxRestrictions, ...sideEffectImportRestrictions];
const timeZoneExemptSourceSyntaxRestrictions: SyntaxRestrictionValue[] = [...navigationRestrictions, ...sideEffectImportRestrictions];
const navigationOwnerSourceSyntaxRestrictions: SyntaxRestrictionValue[] = [...webTimeZoneRestrictions, ...sideEffectImportRestrictions];

const engineCoreRestrictedGlobals: string[] = [
  'addEventListener',
  'BroadcastChannel',
  'caches',
  'cancelAnimationFrame',
  'cancelIdleCallback',
  'clearImmediate',
  'clearInterval',
  'clearTimeout',
  'close',
  'crypto',
  'document',
  'fetch',
  'globalThis',
  'importScripts',
  'indexedDB',
  'localStorage',
  'location',
  'MessageChannel',
  'navigator',
  'onmessage',
  'performance',
  'postMessage',
  'process',
  'removeEventListener',
  'requestAnimationFrame',
  'requestIdleCallback',
  'self',
  'sessionStorage',
  'setImmediate',
  'setInterval',
  'setTimeout',
  'WebSocket',
  'window',
  'Worker',
  'XMLHttpRequest',
];

export default defineConfig(
  {
    ignores: [
      '**/dist/',
      '**/coverage/',
      '**/.turbo/',
      '**/playwright-report/',
      '**/test-results/',
      'packages/contracts/src/gen/',
    ],
  },
  {
    linterOptions: {
      noInlineConfig: true,
      reportUnusedDisableDirectives: 'error',
    },
  },
  {
    files: scriptFiles,
    plugins: {
      local: localPlugin,
    },
    rules: {
      'local/no-comments': 'error',
      'local/specifier-newline': 'error',
    },
  },
  {
    extends: [
      js.configs.recommended,
      tseslint.configs.strictTypeChecked,
      tseslint.configs.stylisticTypeChecked,
      stylistic.configs.customize({
        braceStyle: 'stroustrup',
        commaDangle: 'always-multiline',
        indent: 2,
        quotes: 'single',
        semi: true,
      }),
      perfectionist.configs['recommended-natural'],
    ],
    files: scriptFiles,
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@stylistic/eol-last': ['error', 'always'],
      '@stylistic/max-len': ['error', { code: 140 }],
      '@stylistic/member-delimiter-style': 'error',
      '@stylistic/no-multi-spaces': 'error',
      '@stylistic/no-multiple-empty-lines': ['error', { max: 1 }],
      '@stylistic/object-curly-newline': [
        'error',
        {
          ExportDeclaration: { minProperties: 2, multiline: true },
          ImportDeclaration: { minProperties: 2, multiline: true },
          ObjectExpression: { consistent: true },
          ObjectPattern: { consistent: true },
          TSEnumBody: { consistent: true },
          TSInterfaceBody: { consistent: true },
          TSTypeLiteral: { consistent: true },
        },
      ],
      '@stylistic/type-annotation-spacing': 'error',
      '@typescript-eslint/explicit-function-return-type': [
        'error',
        { allowExpressions: true, allowTypedFunctionExpressions: true },
      ],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-import-type-side-effects': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      'curly': ['error', 'all'],
      'no-param-reassign': ['error', { props: false }],
      'perfectionist/sort-imports': [
        'error',
        { internalPattern: ['^@/.+'] },
      ],
    },
  },
  {
    files: ['apps/web/src/**/*.tsx'],
    rules: {
      'local/no-ui-strings': 'error',
    },
  },
  {
    files: rawControlFiles,
    ignores: rawControlExemptFiles,
    rules: {
      'local/no-raw-controls': 'error',
    },
  },
  {
    extends: [reactHooks.configs.flat.recommended],
    files: ['apps/web/**/*.{ts,tsx}'],
  },
  {
    files: engineCoreFiles,
    rules: {
      'no-restricted-globals': [
        'error',
        ...engineCoreRestrictedGlobals.map(name => ({
          message: `The engine core must not touch ${name} directly; take it through a port`,
          name,
        })),
      ],
      'no-restricted-properties': [
        'error',
        { message: 'Read the time through IClock', object: 'Date', property: 'now' },
        { message: 'Draw numbers through IRandom', object: 'Math', property: 'random' },
      ],
      'no-restricted-syntax': [
        'error',
        {
          message: 'Read the time through IClock; new Date() needs an explicit argument',
          selector: 'NewExpression[callee.name=\'Date\'][arguments.length=0]',
        },
        {
          message: 'Read the time through IClock; Date() returns the current time',
          selector: 'CallExpression[callee.name=\'Date\']',
        },
        ...engineCoreTimeZoneRestrictions,
      ],
    },
  },
  {
    files: engineBoundaryFiles,
    rules: createBoundaryRules(
      [engineRestriction, registryRestriction, apiTestingEntryRestriction, routingTestingEntryRestriction, ...motionRestrictions],
      webSourceSyntaxRestrictions,
    ),
  },
  {
    files: engineBoundaryTestFiles,
    rules: createBoundaryRules([engineRestrictionForTests, registryRestriction, ...motionRestrictions], webSyntaxRestrictions),
  },
  {
    files: engineBoundaryAllowedFiles,
    rules: createBoundaryRules(
      [registryRestriction, apiTestingEntryRestriction, routingTestingEntryRestriction, ...motionRestrictions],
      webSourceSyntaxRestrictions,
    ),
  },
  {
    files: engineBoundaryAllowedTestFiles,
    rules: createBoundaryRules([registryRestriction, ...motionRestrictions], webSyntaxRestrictions),
  },
  {
    files: timeZoneExemptFiles,
    rules: createBoundaryRules(
      [engineRestriction, registryRestriction, apiTestingEntryRestriction, routingTestingEntryRestriction, ...motionRestrictions],
      timeZoneExemptSourceSyntaxRestrictions,
    ),
  },
  {
    files: timeZoneExemptTestFiles,
    rules: createBoundaryRules([engineRestrictionForTests, registryRestriction, ...motionRestrictions], navigationRestrictions),
  },
  {
    files: navigationOwnerFiles,
    rules: createBoundaryRules(
      [engineRestriction, registryRestriction, apiTestingEntryRestriction, routingTestingEntryRestriction, ...motionRestrictions],
      navigationOwnerSourceSyntaxRestrictions,
    ),
  },
  {
    files: navigationOwnerTestFiles,
    rules: createBoundaryRules(
      [engineRestrictionForTests, registryRestriction, ...motionRestrictions],
      webTimeZoneRestrictions,
    ),
  },
  {
    files: motionSegmentFiles,
    rules: createBoundaryRules(
      [engineRestriction, registryRestriction, apiTestingEntryRestriction, routingTestingEntryRestriction],
      webSourceSyntaxRestrictions,
    ),
  },
  {
    files: motionSegmentTestFiles,
    rules: createBoundaryRules([engineRestrictionForTests, registryRestriction], webSyntaxRestrictions),
  },
  {
    files: lazyProfileMenuChunkFiles,
    rules: createBoundaryRules(
      [engineRestriction, registryRestriction, apiTestingEntryRestriction, routingTestingEntryRestriction, motionPackageRestriction],
      webSourceSyntaxRestrictions,
    ),
  },
  {
    files: lazyProfileMenuChunkTestFiles,
    rules: createBoundaryRules([engineRestrictionForTests, registryRestriction, motionPackageRestriction], webSyntaxRestrictions),
  },
  {
    files: lazyAppFiles,
    ignores: webTestFiles,
    rules: createLazyModuleRules(appLazyRestrictions),
  },
  {
    files: lazyWidgetFiles,
    ignores: [...webTestFiles, ...lazyProfileMenuChunkFiles],
    rules: createLazyModuleRules(appLazyRestrictions),
  },
  {
    files: lazyProfileMenuFiles,
    ignores: [...webTestFiles, ...lazyProfileMenuChunkFiles],
    rules: createLazyModuleRules(profileMenuLazyRestrictions),
  },
  {
    extends: [tseslint.configs.disableTypeChecked],
    files: plainScriptFiles,
  },
);
