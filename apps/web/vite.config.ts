import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';
import {
  defineConfig,
  loadEnv,
} from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

import type { BundleBudgetPluginOptionsValue } from './build-budget/bundleBudgetPlugin.ts';
import type { CriticalPreloadEntryValue } from './build-preload/criticalPreloadTypes.ts';

import { APP_BASE_PATH } from './build-base/appBasePath.ts';
import { bootFallbackPlugin } from './build-boot-fallback/bootFallbackPlugin.ts';
import { bundleBudgetPlugin } from './build-budget/bundleBudgetPlugin.ts';
import { extractPackageName } from './build-budget/extractPackageName.ts';
import { hasEntryModule } from './build-budget/isEntryModule.ts';
import {
  DEV_HTTPS_ENV_PREFIX,
  resolveDevHttps,
} from './build-dev-https/resolveDevHttps.ts';
import {
  APP_ICONS,
  getIconSizes,
  isManifestIcon,
} from './build-icons/appIcons.ts';
import { ALLOWED_BUNDLE_LICENSES } from './build-licenses/allowedBundleLicenses.ts';
import { createThirdPartyLicenses } from './build-licenses/createThirdPartyLicenses.ts';
import { removeUnusedBarcodeFonts } from './build-licenses/removeUnusedBarcodeFonts.ts';
import { createCriticalPreload } from './build-preload/createCriticalPreload.ts';
import { DEFAULT_PROFILE_NAME } from './build-profile/buildProfilePaths.ts';
import { buildProfilePlugin } from './build-profile/buildProfilePlugin.ts';
import { loadBuildProfile } from './build-profile/loadBuildProfile.ts';
import { loadProfileMessages } from './build-profile/loadProfileMessages.ts';
import { themeBootScriptPlugin } from './build-theme/themeBootScriptPlugin.ts';
import { appVersionPlugin } from './build-version/appVersionPlugin.ts';
import { createGitHeadReader } from './build-version/readGitHead.ts';
import { resolveAppVersion } from './build-version/resolveAppVersion.ts';
import {
  MANIFEST_BACKGROUND_COLOR,
  THEME_COLOR_BY_THEME,
} from './src/shared/theme/themeConstants.ts';

const HUD_SHARED_MODULES = [
  'node_modules/@connectrpc/connect/dist/esm/code.js',
  'node_modules/@connectrpc/connect/dist/esm/connect-error.js',
  'node_modules/@connectrpc/connect/dist/esm/protocol-connect/code-string.js',
  'node_modules/lucide-react/dist/esm/icons/ban.mjs',
  'node_modules/lucide-react/dist/esm/icons/chevron-down.mjs',
  'node_modules/lucide-react/dist/esm/icons/truck.mjs',
  'packages/contracts/src/gen/access/v1/permission_pb.ts',
  'packages/contracts/src/gen/network/v1/network_pb.ts',
  'packages/contracts/src/gen/notification/v1/notification_events_pb.ts',
  'packages/contracts/src/runtime/permissionCodeNames.ts',
  'packages/demo-engine/src/protocol/constants.ts',
  'src/entities/network/api/fetchNetworkDirectory.ts',
  'src/entities/network/api/fetchMapSites.ts',
  'src/entities/network/api/networkDirectoryQueryOptions.ts',
  'src/entities/network/api/networkKeys.ts',
  'src/entities/network/api/useMapSitesQuery.ts',
  'src/entities/network/api/useNetworkDirectoryQuery.ts',
  'src/entities/transport/api/transportQueryScope.ts',
  'src/features/scene-settings/lib/getDefaultGraphicsPreference.ts',
  'src/features/scene-settings/model/graphicsPreference.ts',
  'src/features/scene-settings/model/graphicsPreferenceStorage.ts',
  'src/features/scene-settings/model/useSceneSettingsStore.ts',
  'src/shared/api/errors/apiErrorFromDetail.ts',
  'src/shared/api/errors/getErrorMessageKey.ts',
  'src/shared/api/errors/isKnownErrorCode.ts',
  'src/shared/api/errors/parseApiError.ts',
  'src/shared/api/errors/translateApiError.ts',
  'src/shared/api/errors/translatePermissionDenial.ts',
  'src/shared/api/pagination/collectPages.ts',
  'src/shared/api/permissions/getPermissionMessageKey.ts',
  'src/shared/api/query/organizationQueryScope.ts',
  'src/shared/routing/address/formatAddressPath.ts',
  'src/shared/routing/react/useNavigate.ts',
  'src/shared/theme/ThemePreferenceContext.ts',
  'src/shared/theme/useThemePreference.ts',
  'src/shared/ui/chunk-load-notice/ChunkLoadNotice.tsx',
  'src/shared/ui/empty-state/EmptyState.tsx',
  'src/shared/ui/tabs/getNextTabIndex.ts',
  'src/shared/ui/tabs/Tabs.tsx',
  'src/entities/organization/api/organizationKeys.ts',
  'src/entities/organization/config/sideBadges.ts',
  'src/widgets/object-inspector/ui/ObjectInspector.tsx',
];

const STARTUP_CONTRACT_MODULES = [
  'node_modules/@bufbuild/protobuf/dist/esm/codegenv2/boot.js',
  'node_modules/@bufbuild/protobuf/dist/esm/codegenv2/enum.js',
  'node_modules/@bufbuild/protobuf/dist/esm/codegenv2/extension.js',
  'node_modules/@bufbuild/protobuf/dist/esm/codegenv2/file.js',
  'node_modules/@bufbuild/protobuf/dist/esm/codegenv2/message.js',
  'node_modules/@bufbuild/protobuf/dist/esm/codegenv2/restore-json-names.js',
  'node_modules/@bufbuild/protobuf/dist/esm/codegenv2/service.js',
  'node_modules/@bufbuild/protobuf/dist/esm/create.js',
  'node_modules/@bufbuild/protobuf/dist/esm/descriptors.js',
  'node_modules/@bufbuild/protobuf/dist/esm/extensions.js',
  'node_modules/@bufbuild/protobuf/dist/esm/from-binary.js',
  'node_modules/@bufbuild/protobuf/dist/esm/is-message.js',
  'node_modules/@bufbuild/protobuf/dist/esm/proto-int64.js',
  'node_modules/@bufbuild/protobuf/dist/esm/reflect/error.js',
  'node_modules/@bufbuild/protobuf/dist/esm/reflect/guard.js',
  'node_modules/@bufbuild/protobuf/dist/esm/reflect/message.js',
  'node_modules/@bufbuild/protobuf/dist/esm/reflect/names.js',
  'node_modules/@bufbuild/protobuf/dist/esm/reflect/nested-types.js',
  'node_modules/@bufbuild/protobuf/dist/esm/reflect/reflect-check.js',
  'node_modules/@bufbuild/protobuf/dist/esm/reflect/reflect.js',
  'node_modules/@bufbuild/protobuf/dist/esm/reflect/scalar.js',
  'node_modules/@bufbuild/protobuf/dist/esm/reflect/unsafe.js',
  'node_modules/@bufbuild/protobuf/dist/esm/registry.js',
  'node_modules/@bufbuild/protobuf/dist/esm/to-binary.js',
  'node_modules/@bufbuild/protobuf/dist/esm/wire/base64-encoding.js',
  'node_modules/@bufbuild/protobuf/dist/esm/wire/binary-encoding.js',
  'node_modules/@bufbuild/protobuf/dist/esm/wire/text-encoding.js',
  'node_modules/@bufbuild/protobuf/dist/esm/wire/text-format.js',
  'node_modules/@bufbuild/protobuf/dist/esm/wire/varint.js',
  'node_modules/@bufbuild/protobuf/dist/esm/wkt/google/protobuf/descriptor_pb.js',
  'node_modules/@bufbuild/protobuf/dist/esm/wkt/google/protobuf/timestamp_pb.js',
  'node_modules/@bufbuild/protobuf/dist/esm/wkt/timestamp.js',
  'node_modules/@bufbuild/protobuf/dist/esm/wkt/wrappers.js',
  'packages/contracts/src/gen/common/v1/entity_pb.ts',
  'packages/contracts/src/gen/common/v1/error_pb.ts',
  'packages/contracts/src/gen/common/v1/field_options_pb.ts',
  'packages/contracts/src/gen/common/v1/money_pb.ts',
  'packages/contracts/src/runtime/channels.ts',
  'packages/contracts/src/runtime/compareCodeUnits.ts',
  'packages/contracts/src/runtime/errorTraits.ts',
  'packages/contracts/src/runtime/index.ts',
];

const CATALOG_CONTRACT_MODULES = [
  'packages/contracts/src/gen/catalog/v1/catalog_pb.ts',
  'packages/contracts/src/gen/catalog/v1/showcase_pb.ts',
];

const LISTING_SHARED_MODULES = [
  'src/entities/listing/api/fetchOwnListings.ts',
  'src/entities/listing/api/fetchShowcaseListings.ts',
  'src/entities/listing/api/listingQueryMeta.ts',
  'src/entities/listing/i18n/listingSection.ts',
  'src/entities/listing/ui/PublicationBadge.tsx',
  'src/entities/organization/lib/isProfileVerified.ts',
  'node_modules/lucide-react/dist/esm/icons/pencil-line.mjs',
];

const ORGANIZATION_CONTRACT_MODULES = [
  'packages/contracts/src/gen/common/v1/method_options_pb.ts',
  'packages/contracts/src/gen/common/v1/page_pb.ts',
  'packages/contracts/src/gen/organization/v1/organization_pb.ts',
];

const CATALOG_EDIT_SHARED_MODULES = [
  'src/entities/listing/api/useOwnListingQuery.ts',
  'src/pages/catalog/lib/formatDestinationLabel.ts',
  'src/pages/catalog/model/catalogTextsContext.ts',
  'src/pages/catalog/model/useCatalogTexts.ts',
  'src/pages/catalog/ui/skeleton/OwnListingInspectorSkeleton.tsx',
  'src/pages/catalog/ui/skeleton/OwnTiersSkeleton.tsx',
  'src/pages/catalog/ui/skeleton/OwnWarehousesSkeleton.tsx',
];

const ORGANIZATION_BADGE_MODULES = [
  'node_modules/lucide-react/dist/esm/icons/badge-check.mjs',
  'node_modules/lucide-react/dist/esm/icons/shield-question-mark.mjs',
  'node_modules/lucide-react/dist/esm/icons/shield.mjs',
  'src/entities/organization/config/verificationLevels.ts',
  'src/entities/organization/lib/normalizeVerificationLevel.ts',
  'src/entities/organization/ui/ProfileBadge.tsx',
  'src/entities/organization/ui/VerificationBadge.tsx',
];

const DEAL_FORM_MODULES = [
  'src/pages/deals/api/commands/dealFormValidation.ts',
  'src/pages/deals/api/commands/useDealWarehouseOptions.ts',
  'src/pages/deals/ui/inspector/DealEditorForm.tsx',
  'src/pages/deals/ui/inspector/DealWarehouseField.tsx',
];

const DEAL_COMMAND_ACCESS_MODULES = [
  'src/entities/session/api/useOrganizationApprovalAccess.ts',
  'src/entities/session/lib/findOrganizationApprovalLimit.ts',
  'src/pages/deals/api/commands/useDealCommandAccess.ts',
];

const DEAL_COMMAND_CONTEXT_MODULES = [
  'src/pages/deals/api/commands/dealCommandContext.ts',
  'src/pages/deals/api/commands/useDealConflictRefresh.ts',
];

const DEAL_DOCUMENT_FORMAT_MODULES = [
  'node_modules/lucide-react/dist/esm/icons/file-pen-line.mjs',
  'node_modules/lucide-react/dist/esm/icons/file-x.mjs',
  'src/pages/deals/ui/folder/documents/DealDocumentStatus.tsx',
  'src/pages/deals/ui/folder/documents/documentLabels.ts',
];

const DEAL_STATUS_MODULES = [
  'node_modules/lucide-react/dist/esm/icons/circle-dot.mjs',
  'node_modules/lucide-react/dist/esm/icons/circle-x.mjs',
  'node_modules/lucide-react/dist/esm/icons/clipboard-list.mjs',
  'src/pages/deals/i18n/dealsSection.ts',
  'src/pages/deals/lib/dealStatus.ts',
  'src/pages/deals/ui/DealStatusBadge.tsx',
];

const MONEY_FORMAT_MODULES = [
  'src/shared/lib/money/formatMinorAsDecimal.ts',
  'src/shared/lib/money/formatMoney.ts',
  'src/shared/lib/money/getMinorScale.ts',
  'src/shared/lib/money/parseDecimalToMinor.ts',
];

const TOOLTIP_SHARED_MODULES = [
  'src/shared/ui/action-button/AccessButton.tsx',
  'src/shared/ui/action-button/ActionButton.tsx',
  'src/shared/ui/action-button/CommandErrorNotice.tsx',
  'src/shared/ui/tooltip/formatShortcut.ts',
  'src/shared/ui/tooltip/Tooltip.tsx',
  'src/shared/ui/tooltip/TooltipGroup.tsx',
  'src/shared/ui/tooltip/TooltipGroupContext.ts',
  'src/shared/ui/tooltip/tooltipStyles.ts',
  'src/shared/ui/tooltip/tooltipTiming.ts',
];

const TOOLTIP_SHARED_PACKAGES = new Set([
  '@floating-ui/core',
  '@floating-ui/dom',
  '@floating-ui/react-dom',
  '@floating-ui/utils',
  '@radix-ui/primitive',
  '@radix-ui/react-compose-refs',
  '@radix-ui/react-context',
  '@radix-ui/react-dismissable-layer',
  '@radix-ui/react-id',
  '@radix-ui/react-popper',
  '@radix-ui/react-portal',
  '@radix-ui/react-presence',
  '@radix-ui/react-primitive',
  '@radix-ui/react-slot',
  '@radix-ui/react-tooltip',
  '@radix-ui/react-use-callback-ref',
  '@radix-ui/react-use-controllable-state',
  '@radix-ui/react-use-effect-event',
  '@radix-ui/react-use-layout-effect',
  '@radix-ui/react-use-size',
  '@radix-ui/react-visually-hidden',
]);

const SIDE_SHAPE_MODULES = [
  'src/entities/organization/config/sideShapes.ts',
  'src/entities/organization/ui/SideShape.tsx',
];

const LIST_HELPER_MODULES = [
  'src/entities/warehouse/api/warehouseKeys.ts',
  'src/shared/lib/scroll/resolveScrollBehavior.ts',
];

const MAX_INITIAL_GZIP_KILOBYTES = 90;

const MAX_SCENE_GZIP_KILOBYTES = 300;

const MAX_STARTUP_GZIP_KILOBYTES = 95;

const MAX_CREATE_WAREHOUSE_FORM_GZIP_KILOBYTES = 46.2;

const MAX_WAREHOUSE_WORKSPACE_GZIP_KILOBYTES = 57.7;

const MAX_WAREHOUSE_RECEIVE_FORM_GZIP_KILOBYTES = 77.4;

const MAX_NETWORK_INSPECTOR_GZIP_KILOBYTES = 26;

const MAX_NETWORK_ORGANIZATION_CARD_GZIP_KILOBYTES = 10;

const MAX_NETWORK_MINI_MAP_GZIP_KILOBYTES = 3;

const MAX_NETWORK_SITES_GZIP_KILOBYTES = 4.5;

const MAX_NETWORK_COMPANIES_GZIP_KILOBYTES = 12.5;

const MAX_NETWORK_TRIP_READ_GZIP_KILOBYTES = 19.2;

const MAX_NETWORK_TRIP_LIST_GZIP_KILOBYTES = 3.55;

const MAX_NETWORK_TRIP_ACTORS_GZIP_KILOBYTES = 4.95;

const MAX_ORGANIZATION_TABLE_GZIP_KILOBYTES = 12;

const MAX_MY_PROFILE_GZIP_KILOBYTES = 66.4;

const MAX_WORLD_MODELS_KILOBYTES = 300;

const MAX_ORGANIZATION_LOGOS_KILOBYTES = 40;

const MAX_ASSISTANT_PORTRAITS_KILOBYTES = 6;

const MAX_NOTIFICATION_CENTER_GZIP_KILOBYTES = 34.6;

const MAX_NOTIFICATION_CENTER_TEXTS_GZIP_KILOBYTES = 1.5;

const MAX_NOTIFICATION_UNREAD_REPORTER_GZIP_KILOBYTES = 4;

const MAX_ASSISTANT_HOST_GZIP_KILOBYTES = 14.3;

const MAX_ASSISTANT_TEXTS_GZIP_KILOBYTES = 2.1;

const MAX_ASSISTANT_TEXTS_INFORMAL_GZIP_KILOBYTES = 3.2;

const MAX_SUPPORT_CHAT_GZIP_KILOBYTES = 36.9;

const MAX_SUPPORT_CHAT_TEXTS_GZIP_KILOBYTES = 3;

const MAX_REQUISITES_FORM_GZIP_KILOBYTES = 55.9;

const MAX_REQUISITES_TEXTS_GZIP_KILOBYTES = 1.6;

const MAX_GARAGE_PAGE_GZIP_KILOBYTES = 36.45;

const MAX_GARAGE_EDITOR_GZIP_KILOBYTES = 65.7;

const MAX_GARAGE_TEXTS_GZIP_KILOBYTES = 4;

const MAX_TRANSPORT_WORKSPACE_GZIP_KILOBYTES = 19.7;

const MAX_TRANSPORT_INSPECTOR_GZIP_KILOBYTES = 53.25;

const MAX_TRANSPORT_EDITOR_GZIP_KILOBYTES = 76.45;

const MAX_DEAL_TRANSPORT_GZIP_KILOBYTES = 41.85;

const MAX_PUBLISH_TRANSPORT_FORM_GZIP_KILOBYTES = 67.35;

const MAX_TRANSPORT_TEXTS_GZIP_KILOBYTES = 3.75;

const MAX_CATALOG_PAGE_GZIP_KILOBYTES = 27.7;

const MAX_CATALOG_OWN_GZIP_KILOBYTES = 31;

const MAX_CATALOG_IMPORT_GZIP_KILOBYTES = 59.5;

const MAX_CATALOG_TEXTS_GZIP_KILOBYTES = 2.8;

const MAX_LISTING_EDITOR_GZIP_KILOBYTES = 75.8;

const MAX_CATALOG_EDITOR_TEXTS_GZIP_KILOBYTES = 2.5;

const MAX_SALES_TERMS_FORM_GZIP_KILOBYTES = 75.8;

const MAX_GLOBAL_SEARCH_GZIP_KILOBYTES = 19.4;

const MAX_GLOBAL_SEARCH_TEXTS_GZIP_KILOBYTES = 1.4;

const MAX_DEALS_BOARD_GZIP_KILOBYTES = 18.79;

const MAX_DEAL_INSPECTOR_GZIP_KILOBYTES = 68.89;

const MAX_DEAL_TRACKER_GZIP_KILOBYTES = 20;

const MAX_DEAL_STANDARD_FORMS_GZIP_KILOBYTES = 70.25;

const MAX_DEAL_FOLDER_GZIP_KILOBYTES = 54;

const MAX_DEAL_WAREHOUSE_RECEIPT_GZIP_KILOBYTES = 45.4;

const MAX_DOCUMENT_VIEW_GZIP_KILOBYTES = 57.56;

const MAX_DEAL_DRAFT_FORM_GZIP_KILOBYTES = 60.12;

const MAX_DOCUMENT_INDEX_GZIP_KILOBYTES = 16.82;

const MAX_DOCUMENT_ROUTE_GZIP_KILOBYTES = 2.09;

const MAX_GLOBAL_SEARCH_DIRECTORY_GZIP_KILOBYTES = 1.61;

const MAX_COUNTER_FORM_GZIP_KILOBYTES = 70.3;

const MAX_DEALS_TEXTS_GZIP_KILOBYTES = 2.63;

const MAX_CATALOG_LISTING_INSPECTOR_GZIP_KILOBYTES = 31.76;

const MAX_ORDER_LAUNCHER_GZIP_KILOBYTES = 50.18;

const MAX_ORDER_FORM_GZIP_KILOBYTES = 80.46;

const MAX_ORDER_TEXTS_GZIP_KILOBYTES = 1.27;

const MAX_GLOBAL_SEARCH_DEALS_GZIP_KILOBYTES = 24.54;

const MAX_ENGINE_WORKER_GZIP_KILOBYTES = 40;

const MAX_ENGINE_GZIP_KILOBYTES = 180.3;

const MAX_ENGINE_SEED_GZIP_KILOBYTES = 14.53;

const MAX_ENGINE_SEED_WITH_TOPOLOGY_GZIP_KILOBYTES = 17;

const MAX_ENGINE_WAREHOUSE_WORKSPACE_SEED_GZIP_KILOBYTES = 10.5;

const MAX_ENGINE_STOCK_GZIP_KILOBYTES = 6;

const MAX_ENGINE_STOCK_OPENING_GZIP_KILOBYTES = 9;

const MAX_ENGINE_FLEET_MIGRATION_GZIP_KILOBYTES = 2.05;

const MAX_ENGINE_FLEET_GZIP_KILOBYTES = 2.21;

const MAX_ENGINE_LOGISTICS_GZIP_KILOBYTES = 5.5;

const MAX_ENGINE_LOGISTICS_PUBLISH_GZIP_KILOBYTES = 6.7;

const MAX_ENGINE_TRANSPORT_OFFER_GZIP_KILOBYTES = 5.9;

const MAX_ENGINE_CARRIER_BOTS_GZIP_KILOBYTES = 6.1;

const MAX_ENGINE_TRIP_GZIP_KILOBYTES = 10.75;

const MAX_ENGINE_TRIP_ASSIGNMENT_GZIP_KILOBYTES = 2.1;

const MAX_ENGINE_TRIP_MIGRATION_GZIP_KILOBYTES = 1;

const MAX_ENGINE_IMPORT_GZIP_KILOBYTES = 184.37;

const MAX_ENGINE_WAREHOUSE_IMPORT_GZIP_KILOBYTES = 16;

const MAX_ENGINE_SEED_HISTORY_GZIP_KILOBYTES = 3.55;

const MAX_ENGINE_SUPPLIER_BOTS_GZIP_KILOBYTES = 7.14;

const MAX_ENGINE_XLSX_GZIP_KILOBYTES = 25.54;

const MAX_ENGINE_CSV_GZIP_KILOBYTES = 2;

const MAX_ENGINE_DOCUMENTS_GZIP_KILOBYTES = 4;

const MAX_ENGINE_NEGOTIATION_GZIP_KILOBYTES = 4.2;

const MAX_ENGINE_PAYMENTS_GZIP_KILOBYTES = 3;

const MAX_ENGINE_EXCHANGE_PAYMENTS_GZIP_KILOBYTES = 6.1;

const MAX_PRECACHED_FILE_BYTES = 2 * 1024 * 1024;

const PRECACHE_GLOB_PATTERNS = [
  '**/*.{js,css,html,woff2,svg,png,bin}',
  'templates/catalog-template.xlsx',
  'templates/opening-stock-template.xlsx',
  'templates/warehouse-cells-template.xlsx',
];

const NAVIGATE_FALLBACK_DENYLIST = [/^[^?]*\/[^/?]*\.(?!html(?:\?|$))[^/.?]+(?:\?|$)/];

const ASSET_BUDGETS = [
  {
    directory: 'assets',
    extensions: ['.wasm'],
    isRequired: true,
    maxKiloBytes: 950,
    name: 'warehouse-camera-decoder-wasm',
  },
  {
    directory: 'models',
    extensions: ['.bin'],
    isRequired: true,
    maxKiloBytes: MAX_WORLD_MODELS_KILOBYTES,
    name: 'world-models',
  },
  {
    directory: 'logos',
    extensions: ['.svg'],
    isRequired: true,
    maxKiloBytes: MAX_ORGANIZATION_LOGOS_KILOBYTES,
    name: 'organization-logos',
  },
  {
    directory: 'assistant',
    extensions: ['.svg'],
    isRequired: true,
    maxKiloBytes: MAX_ASSISTANT_PORTRAITS_KILOBYTES,
    name: 'assistant',
  },
];

const XLSX_READER_PACKAGES = ['read-excel-file', 'fflate', 'saxen'];

const FORBIDDEN_PACKAGES = [...XLSX_READER_PACKAGES, 'stats-gl', 'stats.js', 'zxing-wasm'];

const FORBIDDEN_SCENE_PACKAGES = [
  '@bufbuild/protobuf',
  '@connectrpc/*',
  '@radix-ui/*',
  '@tanstack/*',
  'framer-motion',
  'maska',
  'motion',
  'motion-dom',
  'motion-utils',
  'react-hook-form',
];

const FORBIDDEN_STARTUP_PACKAGES = [
  '@radix-ui/*',
  '@react-three/*',
  'camera-controls',
  'framer-motion',
  'maska',
  'motion',
  'motion-dom',
  'motion-utils',
  'react-hook-form',
  'three',
];

const CATALOG_FORBIDDEN_PACKAGES = ['@react-three/*', 'three', 'maska', 'react-hook-form'];

const STARTUP_BASELINE = 'startup';

const CRITICAL_PATH_ENTRIES: readonly CriticalPreloadEntryValue[] = [
  { entry: 'src/app/bootstrap/mountApp.tsx', isRequired: true },
  { entry: 'src/shared/api/transport/demo/index.ts', isDemoOnly: true, isRequired: true },
];

const PREWARMED_SECTION_ENTRY = 'src/pages/network/index.ts';

const ENGINE_WORKER_ENTRIES = ['packages/demo-engine/src/host/worker.ts'];

const ENGINE_WORKER_DYNAMIC_ENTRIES = ['packages/demo-engine/src/core/engine/index.ts'];

const ENGINE_IMPORT_ENTRY = 'packages/demo-engine/src/core/modules/import/importService.ts';

const DEFERRED_PRELOAD_ENTRIES = [...ENGINE_WORKER_ENTRIES, ...ENGINE_WORKER_DYNAMIC_ENTRIES];

const PRINT_WORKER_BUDGET = {
  forbiddenInitialPackages: ['@react-three/*', 'react', 'three'],
  maxInitialGzipKiloBytes: 65,
  targetEntries: ['src/features/print-labels/lib/printCodes.worker.ts'],
} satisfies BundleBudgetPluginOptionsValue;

const CAMERA_WORKER_BUDGET = {
  forbiddenInitialPackages: ['@react-three/*', 'react', 'three'],
  maxInitialGzipKiloBytes: 30,
  targetEntries: ['src/pages/warehouse/model/scan/camera/cameraDecoder.worker.ts'],
} satisfies BundleBudgetPluginOptionsValue;

const ENGINE_WORKER_BUDGET = {
  forbiddenInitialPackages: XLSX_READER_PACKAGES,
  lazyEntryBudgets: [
    {
      entries: ENGINE_WORKER_DYNAMIC_ENTRIES,
      forbiddenPackages: XLSX_READER_PACKAGES,
      isRequired: true,
      maxGzipKiloBytes: MAX_ENGINE_GZIP_KILOBYTES,
      name: 'engine',
    },
    {
      baseline: 'engine',
      entries: ['packages/demo-engine/src/core/seed/seedSnapshot.ts'],
      isRequired: true,
      maxGzipKiloBytes: MAX_ENGINE_SEED_GZIP_KILOBYTES,
      name: 'engine-seed',
    },
    {
      baseline: 'engine',
      entries: [
        'packages/demo-engine/src/core/engine/migrateWarehouseTopologies.ts',
        'packages/demo-engine/src/core/seed/seedSnapshot.ts',
        'packages/demo-engine/src/core/seed/seedSnapshotWithTopology.ts',
      ],
      isRequired: true,
      maxGzipKiloBytes: MAX_ENGINE_SEED_WITH_TOPOLOGY_GZIP_KILOBYTES,
      name: 'engine-seed-with-topology',
    },
    {
      baseline: 'engine',
      entries: [
        'packages/demo-engine/src/core/seed/readSeedWarehouseStock.ts',
        'packages/demo-engine/src/core/seed/seedWarehouseWorkspace.ts',
      ],
      forbiddenPackages: XLSX_READER_PACKAGES,
      isRequired: true,
      maxGzipKiloBytes: MAX_ENGINE_WAREHOUSE_WORKSPACE_SEED_GZIP_KILOBYTES,
      name: 'engine-warehouse-workspace-seed',
    },
    {
      baseline: 'engine',
      entries: ['packages/demo-engine/src/core/modules/wms/warehouseStockService.ts'],
      isRequired: true,
      maxGzipKiloBytes: MAX_ENGINE_STOCK_GZIP_KILOBYTES,
      name: 'engine-stock',
    },
    {
      baseline: 'engine',
      entries: [
        'packages/demo-engine/src/core/modules/wms/warehouseStockService.ts',
        'packages/demo-engine/src/core/modules/wms/postOpeningStock.ts',
      ],
      isRequired: true,
      maxGzipKiloBytes: MAX_ENGINE_STOCK_OPENING_GZIP_KILOBYTES,
      name: 'engine-stock-opening',
    },
    {
      baseline: 'engine',
      entries: ['packages/demo-engine/src/core/seed/seedDealHistory.ts'],
      isRequired: true,
      maxGzipKiloBytes: MAX_ENGINE_SEED_HISTORY_GZIP_KILOBYTES,
      name: 'engine-seed-history',
    },
    {
      baseline: 'engine',
      entries: ['packages/demo-engine/src/core/seed/seedFleet.ts'],
      isRequired: true,
      maxGzipKiloBytes: MAX_ENGINE_FLEET_MIGRATION_GZIP_KILOBYTES,
      name: 'engine-fleet-migration',
    },
    {
      baseline: 'engine',
      entries: ['packages/demo-engine/src/core/engine/migrateTripRecords.ts'],
      isRequired: true,
      maxGzipKiloBytes: MAX_ENGINE_TRIP_MIGRATION_GZIP_KILOBYTES,
      name: 'engine-trip-migration',
    },
    {
      baseline: 'engine',
      entries: ['packages/demo-engine/src/core/modules/fleet/index.ts'],
      isRequired: true,
      maxGzipKiloBytes: MAX_ENGINE_FLEET_GZIP_KILOBYTES,
      name: 'engine-fleet',
    },
    {
      baseline: 'engine',
      entries: ['packages/demo-engine/src/core/modules/logistics/index.ts'],
      isRequired: true,
      maxGzipKiloBytes: MAX_ENGINE_LOGISTICS_GZIP_KILOBYTES,
      name: 'engine-logistics',
    },
    {
      baseline: 'engine',
      entries: ['packages/demo-engine/src/core/modules/logistics/publishTransportRequest.ts'],
      isRequired: true,
      maxGzipKiloBytes: MAX_ENGINE_LOGISTICS_PUBLISH_GZIP_KILOBYTES,
      name: 'engine-logistics-publish',
    },
    {
      baseline: 'engine',
      entries: ['packages/demo-engine/src/core/modules/logistics/submitTransportOffer.ts'],
      isRequired: true,
      maxGzipKiloBytes: MAX_ENGINE_TRANSPORT_OFFER_GZIP_KILOBYTES,
      name: 'engine-transport-offer',
    },
    {
      baseline: 'engine',
      entries: ['packages/demo-engine/src/core/modules/carrier-bots/index.ts'],
      isRequired: true,
      maxGzipKiloBytes: MAX_ENGINE_CARRIER_BOTS_GZIP_KILOBYTES,
      name: 'engine-carrier-bots',
    },
    {
      baseline: 'engine',
      entries: [
        'packages/demo-engine/src/core/modules/logistics/selectTransportOffer.ts',
        'packages/demo-engine/src/core/modules/logistics/tripService.ts',
      ],
      isRequired: true,
      maxGzipKiloBytes: MAX_ENGINE_TRIP_GZIP_KILOBYTES,
      name: 'engine-trip',
    },
    {
      baseline: 'engine',
      entries: ['packages/demo-engine/src/core/modules/logistics/tripAssignment.ts'],
      isRequired: true,
      maxGzipKiloBytes: MAX_ENGINE_TRIP_ASSIGNMENT_GZIP_KILOBYTES,
      name: 'engine-trip-assignment',
    },
    {
      baseline: 'engine',
      entries: ['packages/demo-engine/src/core/modules/supplier-bots/index.ts'],
      isRequired: true,
      maxGzipKiloBytes: MAX_ENGINE_SUPPLIER_BOTS_GZIP_KILOBYTES,
      name: 'engine-supplier-bots',
    },
    {
      entries: [...ENGINE_WORKER_DYNAMIC_ENTRIES, ENGINE_IMPORT_ENTRY],
      forbiddenPackages: XLSX_READER_PACKAGES,
      isRequired: true,
      maxGzipKiloBytes: MAX_ENGINE_IMPORT_GZIP_KILOBYTES,
      name: 'engine-import',
    },
    {
      baseline: 'engine-import',
      entries: ['packages/demo-engine/src/core/modules/import/warehouseImport.ts'],
      forbiddenPackages: XLSX_READER_PACKAGES,
      isRequired: true,
      maxGzipKiloBytes: MAX_ENGINE_WAREHOUSE_IMPORT_GZIP_KILOBYTES,
      name: 'engine-warehouse-import',
    },
    {
      baseline: 'engine-import',
      entries: ['packages/demo-engine/src/core/modules/import/csvReader.ts'],
      isRequired: true,
      maxGzipKiloBytes: MAX_ENGINE_CSV_GZIP_KILOBYTES,
      name: 'engine-csv',
    },
    {
      baseline: 'engine',
      entries: ['packages/demo-engine/src/core/modules/documents/index.ts'],
      isRequired: true,
      maxGzipKiloBytes: MAX_ENGINE_DOCUMENTS_GZIP_KILOBYTES,
      name: 'engine-documents',
    },
    {
      baseline: 'engine',
      entries: ['packages/demo-engine/src/core/modules/deals/dealNegotiation.ts'],
      isRequired: true,
      maxGzipKiloBytes: MAX_ENGINE_NEGOTIATION_GZIP_KILOBYTES,
      name: 'engine-negotiation',
    },
    {
      baseline: 'engine',
      entries: ['packages/demo-engine/src/core/modules/payments/index.ts'],
      isRequired: true,
      maxGzipKiloBytes: MAX_ENGINE_PAYMENTS_GZIP_KILOBYTES,
      name: 'engine-payments',
    },
    {
      baseline: 'engine',
      entries: ['packages/demo-engine/src/core/modules/payments/exchangePayment.ts'],
      isRequired: true,
      maxGzipKiloBytes: MAX_ENGINE_EXCHANGE_PAYMENTS_GZIP_KILOBYTES,
      name: 'engine-exchange-payments',
    },
    {
      baseline: 'engine-import',
      entries: ['packages/demo-engine/src/core/modules/import/xlsxReader.ts'],
      isRequired: true,
      maxGzipKiloBytes: MAX_ENGINE_XLSX_GZIP_KILOBYTES,
      name: 'engine-xlsx',
    },
  ],
  maxInitialGzipKiloBytes: MAX_ENGINE_WORKER_GZIP_KILOBYTES,
  targetEntries: ENGINE_WORKER_ENTRIES,
} satisfies BundleBudgetPluginOptionsValue;

const isDemoTransport = loadEnv('production', import.meta.dirname, 'VITE_').VITE_API_TRANSPORT !== 'connect';

const STARTUP_BUDGET_ENTRIES = [
  ...CRITICAL_PATH_ENTRIES
    .filter(({ isDemoOnly }) => isDemoTransport || isDemoOnly !== true)
    .map(({ entry }) => entry),
  PREWARMED_SECTION_ENTRY,
];

const LAZY_ENTRY_BUDGETS = [
  {
    entries: ['src/widgets/scene-viewport/scene/SceneRoot.tsx', 'src/pages/network/scene/NetworkWorldScene.tsx'],
    forbiddenPackages: FORBIDDEN_SCENE_PACKAGES,
    isRequired: true,
    maxGzipKiloBytes: MAX_SCENE_GZIP_KILOBYTES,
    name: 'scene',
  },
  {
    entries: STARTUP_BUDGET_ENTRIES,
    forbiddenPackages: FORBIDDEN_STARTUP_PACKAGES,
    isRequired: true,
    maxGzipKiloBytes: MAX_STARTUP_GZIP_KILOBYTES,
    name: STARTUP_BASELINE,
  },
  {
    baseline: STARTUP_BASELINE,
    entries: ['src/features/create-warehouse/ui/form/CreateWarehouseForm.tsx'],
    forbiddenPackages: ['maska'],
    isRequired: true,
    maxGzipKiloBytes: MAX_CREATE_WAREHOUSE_FORM_GZIP_KILOBYTES,
    name: 'create-warehouse-form',
  },
  {
    baseline: STARTUP_BASELINE,
    entries: ['src/pages/warehouse/ui/workspace/WarehouseWorkspaceRoute.tsx'],
    forbiddenPackages: CATALOG_FORBIDDEN_PACKAGES,
    isRequired: true,
    maxGzipKiloBytes: MAX_WAREHOUSE_WORKSPACE_GZIP_KILOBYTES,
    name: 'warehouse-workspace',
  },
  {
    baseline: STARTUP_BASELINE,
    entries: ['src/features/print-labels/ui/PrintLabelsPreview.tsx'],
    forbiddenPackages: ['@bwip-js/*', '@react-three/*', 'three'],
    isRequired: true,
    maxGzipKiloBytes: 10,
    name: 'print-labels-preview',
  },
  {
    baseline: STARTUP_BASELINE,
    entries: ['src/pages/warehouse/ui/workspace/WarehouseCameraScanner.tsx'],
    forbiddenPackages: ['@react-three/*', 'three', 'zxing-wasm'],
    isRequired: true,
    maxGzipKiloBytes: 12,
    name: 'warehouse-camera-scanner',
  },
  {
    baseline: STARTUP_BASELINE,
    entries: ['src/pages/warehouse/ui/workspace/WarehouseReceiveForm.tsx'],
    forbiddenPackages: ['@react-three/*', 'three', 'maska'],
    isRequired: true,
    maxGzipKiloBytes: MAX_WAREHOUSE_RECEIVE_FORM_GZIP_KILOBYTES,
    name: 'warehouse-receive-form',
  },
  {
    baseline: STARTUP_BASELINE,
    entries: ['src/pages/network/ui/inspector/NetworkInspectorBody.tsx'],
    isRequired: true,
    maxGzipKiloBytes: MAX_NETWORK_INSPECTOR_GZIP_KILOBYTES,
    name: 'network-inspector',
  },
  {
    baseline: STARTUP_BASELINE,
    entries: ['src/pages/network/ui/organization-card/OrganizationInspector.tsx'],
    isRequired: true,
    maxGzipKiloBytes: MAX_NETWORK_ORGANIZATION_CARD_GZIP_KILOBYTES,
    name: 'network-organization-card',
  },
  {
    baseline: STARTUP_BASELINE,
    entries: ['src/pages/network/ui/mini-map/NetworkMiniMap.tsx'],
    isRequired: true,
    maxGzipKiloBytes: MAX_NETWORK_MINI_MAP_GZIP_KILOBYTES,
    name: 'network-mini-map',
  },
  {
    baseline: STARTUP_BASELINE,
    entries: ['src/pages/network/ui/sites/NetworkSitesPanel.tsx'],
    isRequired: true,
    maxGzipKiloBytes: MAX_NETWORK_SITES_GZIP_KILOBYTES,
    name: 'network-sites',
  },
  {
    baseline: STARTUP_BASELINE,
    entries: ['src/pages/network/ui/companies/NetworkCompaniesPanel.tsx'],
    isRequired: true,
    maxGzipKiloBytes: MAX_NETWORK_COMPANIES_GZIP_KILOBYTES,
    name: 'network-companies',
  },
  {
    baseline: STARTUP_BASELINE,
    entries: ['src/pages/network/api/readNetworkTrips.ts'],
    forbiddenPackages: CATALOG_FORBIDDEN_PACKAGES,
    isRequired: true,
    maxGzipKiloBytes: MAX_NETWORK_TRIP_READ_GZIP_KILOBYTES,
    name: 'network-trip-read',
  },
  {
    baseline: STARTUP_BASELINE,
    entries: ['src/pages/network/ui/NetworkTripsList.tsx'],
    forbiddenPackages: CATALOG_FORBIDDEN_PACKAGES,
    isRequired: true,
    maxGzipKiloBytes: MAX_NETWORK_TRIP_LIST_GZIP_KILOBYTES,
    name: 'network-trip-list',
  },
  {
    baseline: 'scene',
    entries: ['src/pages/network/scene/trips/NetworkTripActors.tsx'],
    forbiddenPackages: FORBIDDEN_SCENE_PACKAGES,
    isRequired: true,
    maxGzipKiloBytes: MAX_NETWORK_TRIP_ACTORS_GZIP_KILOBYTES,
    name: 'network-trip-actors',
  },
  {
    baseline: STARTUP_BASELINE,
    entries: ['src/pages/network/ui/directory/OrganizationDirectoryPanel.tsx'],
    isRequired: true,
    maxGzipKiloBytes: MAX_ORGANIZATION_TABLE_GZIP_KILOBYTES,
    name: 'organization-table',
  },
  {
    baseline: STARTUP_BASELINE,
    entries: ['src/widgets/profile-menu/ui/my-profile/ProfileMyProfile.tsx'],
    isRequired: true,
    maxGzipKiloBytes: MAX_MY_PROFILE_GZIP_KILOBYTES,
    name: 'my-profile',
  },
  {
    baseline: STARTUP_BASELINE,
    entries: ['src/widgets/notification-center/ui/panel/NotificationCenterPanel.tsx'],
    isRequired: true,
    maxGzipKiloBytes: MAX_NOTIFICATION_CENTER_GZIP_KILOBYTES,
    name: 'notification-center',
  },
  {
    baseline: STARTUP_BASELINE,
    entries: ['src/widgets/notification-center/ui/reporter/UnreadCountReporterBody.tsx'],
    isRequired: true,
    maxGzipKiloBytes: MAX_NOTIFICATION_UNREAD_REPORTER_GZIP_KILOBYTES,
    name: 'notification-unread-reporter',
  },
  {
    baseline: STARTUP_BASELINE,
    entries: ['src/widgets/notification-center/i18n/catalogs/ru.ts'],
    isRequired: true,
    maxGzipKiloBytes: MAX_NOTIFICATION_CENTER_TEXTS_GZIP_KILOBYTES,
    name: 'notification-center-texts',
  },
  {
    baseline: STARTUP_BASELINE,
    entries: ['src/widgets/assistant/ui/host/AssistantHost.tsx'],
    isRequired: true,
    maxGzipKiloBytes: MAX_ASSISTANT_HOST_GZIP_KILOBYTES,
    name: 'assistant',
  },
  {
    baseline: STARTUP_BASELINE,
    entries: ['src/widgets/assistant/i18n/catalogs/ru.ts'],
    isRequired: true,
    maxGzipKiloBytes: MAX_ASSISTANT_TEXTS_GZIP_KILOBYTES,
    name: 'assistant-texts',
  },
  {
    baseline: STARTUP_BASELINE,
    entries: ['src/widgets/assistant/i18n/catalogs/ru.informal.ts'],
    isRequired: true,
    maxGzipKiloBytes: MAX_ASSISTANT_TEXTS_INFORMAL_GZIP_KILOBYTES,
    name: 'assistant-texts-informal',
  },
  {
    baseline: STARTUP_BASELINE,
    entries: ['src/widgets/support-chat/ui/chat/SupportChat.tsx'],
    isRequired: true,
    maxGzipKiloBytes: MAX_SUPPORT_CHAT_GZIP_KILOBYTES,
    name: 'support-chat',
  },
  {
    baseline: STARTUP_BASELINE,
    entries: ['src/widgets/support-chat/i18n/catalogs/ru.ts', 'src/widgets/support-chat/i18n/catalogs/ru.informal.ts'],
    isRequired: true,
    maxGzipKiloBytes: MAX_SUPPORT_CHAT_TEXTS_GZIP_KILOBYTES,
    name: 'support-chat-texts',
  },
  {
    baseline: STARTUP_BASELINE,
    entries: ['src/features/edit-requisites/ui/panel/RequisitesPanel.tsx'],
    forbiddenPackages: ['@react-three/*', 'three'],
    isRequired: true,
    maxGzipKiloBytes: MAX_REQUISITES_FORM_GZIP_KILOBYTES,
    name: 'requisites-form',
  },
  {
    baseline: STARTUP_BASELINE,
    entries: ['src/features/edit-requisites/i18n/catalogs/ru.ts'],
    isRequired: true,
    maxGzipKiloBytes: MAX_REQUISITES_TEXTS_GZIP_KILOBYTES,
    name: 'requisites-texts',
  },
  {
    baseline: STARTUP_BASELINE,
    entries: ['src/pages/carrier-garage/ui/CarrierGaragePage.tsx'],
    forbiddenPackages: CATALOG_FORBIDDEN_PACKAGES,
    isRequired: true,
    maxGzipKiloBytes: MAX_GARAGE_PAGE_GZIP_KILOBYTES,
    name: 'garage-page',
  },
  {
    baseline: STARTUP_BASELINE,
    entries: [
      'src/pages/carrier-garage/ui/CarrierGaragePage.tsx',
      'src/pages/carrier-garage/ui/GarageEditorSlot.tsx',
    ],
    forbiddenPackages: ['@react-three/*', 'three'],
    isRequired: true,
    maxGzipKiloBytes: MAX_GARAGE_EDITOR_GZIP_KILOBYTES,
    name: 'garage-editor',
  },
  {
    baseline: STARTUP_BASELINE,
    entries: [
      'src/pages/carrier-garage/i18n/ru.ts',
      'src/pages/carrier-garage/records/i18n/catalogs/ru.ts',
      'src/pages/carrier-garage/vehicle/ru.ts',
    ],
    isRequired: true,
    maxGzipKiloBytes: MAX_GARAGE_TEXTS_GZIP_KILOBYTES,
    name: 'garage-texts',
  },
  {
    baseline: STARTUP_BASELINE,
    entries: ['src/pages/transport-workspace/index.ts'],
    forbiddenPackages: CATALOG_FORBIDDEN_PACKAGES,
    isRequired: true,
    maxGzipKiloBytes: MAX_TRANSPORT_WORKSPACE_GZIP_KILOBYTES,
    name: 'transport-workspace',
  },
  {
    baseline: STARTUP_BASELINE,
    entries: ['src/pages/transport-workspace/ui/transportInspectorEntry.ts'],
    forbiddenPackages: CATALOG_FORBIDDEN_PACKAGES,
    isRequired: true,
    maxGzipKiloBytes: MAX_TRANSPORT_INSPECTOR_GZIP_KILOBYTES,
    name: 'transport-inspector',
  },
  {
    baseline: STARTUP_BASELINE,
    entries: ['src/pages/transport-workspace/ui/forms/transportEditorEntry.ts'],
    forbiddenPackages: ['@react-three/*', 'three'],
    isRequired: true,
    maxGzipKiloBytes: MAX_TRANSPORT_EDITOR_GZIP_KILOBYTES,
    name: 'transport-editor',
  },
  {
    baseline: STARTUP_BASELINE,
    entries: ['src/pages/deals/ui/transport/dealTransportEntry.tsx'],
    forbiddenPackages: CATALOG_FORBIDDEN_PACKAGES,
    isRequired: true,
    maxGzipKiloBytes: MAX_DEAL_TRANSPORT_GZIP_KILOBYTES,
    name: 'deal-transport',
  },
  {
    baseline: STARTUP_BASELINE,
    entries: ['src/pages/deals/ui/transport/PublishTransportForm.tsx'],
    forbiddenPackages: ['@react-three/*', 'three'],
    isRequired: true,
    maxGzipKiloBytes: MAX_PUBLISH_TRANSPORT_FORM_GZIP_KILOBYTES,
    name: 'publish-transport-form',
  },
  {
    baseline: STARTUP_BASELINE,
    entries: ['src/pages/transport-workspace/i18n/ru.ts', 'src/pages/deals/ui/transport/dealTransportRu.ts'],
    isRequired: true,
    maxGzipKiloBytes: MAX_TRANSPORT_TEXTS_GZIP_KILOBYTES,
    name: 'transport-texts',
  },
  {
    baseline: STARTUP_BASELINE,
    entries: ['src/pages/deals/ui/DealsPage.tsx'],
    forbiddenPackages: CATALOG_FORBIDDEN_PACKAGES,
    isRequired: true,
    maxGzipKiloBytes: MAX_DEALS_BOARD_GZIP_KILOBYTES,
    name: 'deals-board',
  },
  {
    baseline: STARTUP_BASELINE,
    entries: ['src/pages/deals/ui/inspector/dealInspectorEntry.ts'],
    forbiddenPackages: CATALOG_FORBIDDEN_PACKAGES,
    isRequired: true,
    maxGzipKiloBytes: MAX_DEAL_INSPECTOR_GZIP_KILOBYTES,
    name: 'deal-inspector',
  },
  {
    baseline: STARTUP_BASELINE,
    entries: ['src/pages/deals/ui/DealTracker.tsx'],
    forbiddenPackages: CATALOG_FORBIDDEN_PACKAGES,
    isRequired: true,
    maxGzipKiloBytes: MAX_DEAL_TRACKER_GZIP_KILOBYTES,
    name: 'deal-tracker',
  },
  {
    baseline: STARTUP_BASELINE,
    entries: ['src/pages/deals/ui/inspector/DealStandardForms.tsx'],
    forbiddenPackages: ['@react-three/*', 'three'],
    isRequired: true,
    maxGzipKiloBytes: MAX_DEAL_STANDARD_FORMS_GZIP_KILOBYTES,
    name: 'deal-standard-forms',
  },
  {
    baseline: STARTUP_BASELINE,
    entries: ['src/pages/deals/ui/folder/dealFolderEntry.tsx'],
    forbiddenPackages: ['@react-three/*', 'three'],
    isRequired: true,
    maxGzipKiloBytes: MAX_DEAL_FOLDER_GZIP_KILOBYTES,
    name: 'deal-folder',
  },
  {
    baseline: STARTUP_BASELINE,
    entries: ['src/pages/deals/ui/folder/receipt/DealWarehouseReceipt.tsx'],
    forbiddenPackages: CATALOG_FORBIDDEN_PACKAGES,
    isRequired: true,
    maxGzipKiloBytes: MAX_DEAL_WAREHOUSE_RECEIPT_GZIP_KILOBYTES,
    name: 'deal-warehouse-receipt',
  },
  {
    baseline: STARTUP_BASELINE,
    entries: ['src/pages/deals/ui/folder/documents/documentViewEntry.ts'],
    forbiddenPackages: ['@react-three/*', 'three'],
    isRequired: true,
    maxGzipKiloBytes: MAX_DOCUMENT_VIEW_GZIP_KILOBYTES,
    name: 'document-view',
  },
  {
    baseline: STARTUP_BASELINE,
    entries: ['src/pages/deals/ui/inspector/DealDraftForm.tsx'],
    forbiddenPackages: ['@react-three/*', 'three'],
    isRequired: true,
    maxGzipKiloBytes: MAX_DEAL_DRAFT_FORM_GZIP_KILOBYTES,
    name: 'deal-draft-form',
  },
  {
    baseline: STARTUP_BASELINE,
    entries: ['src/entities/document/api/documentIndex.ts'],
    forbiddenPackages: ['@react-three/*', 'three'],
    isRequired: true,
    maxGzipKiloBytes: MAX_DOCUMENT_INDEX_GZIP_KILOBYTES,
    name: 'document-index',
  },
  {
    baseline: STARTUP_BASELINE,
    entries: ['src/pages/deals/ui/DealDocumentRoute.tsx'],
    forbiddenPackages: ['@react-three/*', 'three'],
    isRequired: true,
    maxGzipKiloBytes: MAX_DOCUMENT_ROUTE_GZIP_KILOBYTES,
    name: 'document-route',
  },
  {
    baseline: STARTUP_BASELINE,
    entries: ['src/features/global-search/api/fetchSearchDirectory.ts'],
    forbiddenPackages: CATALOG_FORBIDDEN_PACKAGES,
    isRequired: true,
    maxGzipKiloBytes: MAX_GLOBAL_SEARCH_DIRECTORY_GZIP_KILOBYTES,
    name: 'global-search-directory',
  },
  {
    baseline: STARTUP_BASELINE,
    entries: ['src/pages/deals/ui/inspector/counterFormEntry.ts'],
    forbiddenPackages: ['@react-three/*', 'three'],
    isRequired: true,
    maxGzipKiloBytes: MAX_COUNTER_FORM_GZIP_KILOBYTES,
    name: 'counter-form',
  },
  {
    baseline: STARTUP_BASELINE,
    entries: ['src/pages/deals/i18n/catalogs/ru.ts', 'src/pages/deals/i18n/catalogs/inspectorRu.ts'],
    isRequired: true,
    maxGzipKiloBytes: MAX_DEALS_TEXTS_GZIP_KILOBYTES,
    name: 'deals-texts',
  },
  {
    baseline: STARTUP_BASELINE,
    entries: ['src/pages/catalog/ui/ListingInspector.tsx'],
    forbiddenPackages: CATALOG_FORBIDDEN_PACKAGES,
    isRequired: true,
    maxGzipKiloBytes: MAX_CATALOG_LISTING_INSPECTOR_GZIP_KILOBYTES,
    name: 'catalog-listing-inspector',
  },
  {
    baseline: STARTUP_BASELINE,
    entries: ['src/pages/catalog/ui/order/orderLauncherEntry.ts'],
    forbiddenPackages: CATALOG_FORBIDDEN_PACKAGES,
    isRequired: true,
    maxGzipKiloBytes: MAX_ORDER_LAUNCHER_GZIP_KILOBYTES,
    name: 'order-launcher',
  },
  {
    baseline: STARTUP_BASELINE,
    entries: ['src/pages/catalog/ui/order/orderFormEntry.ts'],
    forbiddenPackages: ['@react-three/*', 'three'],
    isRequired: true,
    maxGzipKiloBytes: MAX_ORDER_FORM_GZIP_KILOBYTES,
    name: 'order-form',
  },
  {
    baseline: STARTUP_BASELINE,
    entries: ['src/pages/catalog/i18n/order/ru.ts'],
    isRequired: true,
    maxGzipKiloBytes: MAX_ORDER_TEXTS_GZIP_KILOBYTES,
    name: 'order-texts',
  },
  {
    baseline: STARTUP_BASELINE,
    entries: ['src/features/global-search/api/findDeals.ts', 'packages/contracts/src/gen/deal/v1/deal_pb.ts'],
    forbiddenPackages: CATALOG_FORBIDDEN_PACKAGES,
    isRequired: true,
    maxGzipKiloBytes: MAX_GLOBAL_SEARCH_DEALS_GZIP_KILOBYTES,
    name: 'global-search-deals',
  },
  {
    baseline: STARTUP_BASELINE,
    entries: ['src/pages/catalog/ui/CatalogPage.tsx'],
    forbiddenPackages: CATALOG_FORBIDDEN_PACKAGES,
    isRequired: true,
    maxGzipKiloBytes: MAX_CATALOG_PAGE_GZIP_KILOBYTES,
    name: 'catalog-page',
  },
  {
    baseline: STARTUP_BASELINE,
    entries: ['src/pages/catalog/ui/own/OwnCatalogPanel.tsx'],
    forbiddenPackages: CATALOG_FORBIDDEN_PACKAGES,
    isRequired: true,
    maxGzipKiloBytes: MAX_CATALOG_OWN_GZIP_KILOBYTES,
    name: 'catalog-own',
  },
  {
    baseline: STARTUP_BASELINE,
    entries: [
      'src/pages/catalog/ui/import/ImportPanel.tsx',
      'src/pages/catalog/i18n/import/ru.ts',
    ],
    forbiddenPackages: CATALOG_FORBIDDEN_PACKAGES,
    isRequired: true,
    maxGzipKiloBytes: MAX_CATALOG_IMPORT_GZIP_KILOBYTES,
    name: 'catalog-import',
  },
  {
    baseline: STARTUP_BASELINE,
    entries: ['src/pages/catalog/ui/listing-editor/ListingEditor.tsx'],
    forbiddenPackages: ['@react-three/*', 'three'],
    isRequired: true,
    maxGzipKiloBytes: MAX_LISTING_EDITOR_GZIP_KILOBYTES,
    name: 'listing-editor',
  },
  {
    baseline: STARTUP_BASELINE,
    entries: ['src/pages/catalog/ui/sales-terms/SalesTermsForm.tsx'],
    forbiddenPackages: ['@react-three/*', 'three'],
    isRequired: true,
    maxGzipKiloBytes: MAX_SALES_TERMS_FORM_GZIP_KILOBYTES,
    name: 'sales-terms-form',
  },
  {
    baseline: STARTUP_BASELINE,
    entries: ['src/pages/catalog/i18n/editor/catalogs/ru.ts'],
    isRequired: true,
    maxGzipKiloBytes: MAX_CATALOG_EDITOR_TEXTS_GZIP_KILOBYTES,
    name: 'catalog-editor-texts',
  },
  {
    baseline: STARTUP_BASELINE,
    entries: ['src/pages/catalog/i18n/catalogs/ru.ts', 'src/entities/listing/i18n/catalogs/ru.ts'],
    isRequired: true,
    maxGzipKiloBytes: MAX_CATALOG_TEXTS_GZIP_KILOBYTES,
    name: 'catalog-texts',
  },
  {
    baseline: STARTUP_BASELINE,
    entries: ['src/features/global-search/ui/panel/searchPanelEntry.ts'],
    forbiddenPackages: CATALOG_FORBIDDEN_PACKAGES,
    isRequired: true,
    maxGzipKiloBytes: MAX_GLOBAL_SEARCH_GZIP_KILOBYTES,
    name: 'global-search',
  },
  {
    baseline: STARTUP_BASELINE,
    entries: ['src/features/global-search/i18n/catalogs/ru.ts'],
    isRequired: true,
    maxGzipKiloBytes: MAX_GLOBAL_SEARCH_TEXTS_GZIP_KILOBYTES,
    name: 'global-search-texts',
  },
];

const FORBIDDEN_INITIAL_PACKAGES = [
  '@bwip-js/*',
  '@bufbuild/protobuf',
  '@connectrpc/*',
  '@radix-ui/*',
  '@react-three/*',
  '@tanstack/*',
  'camera-controls',
  'framer-motion',
  'motion',
  'motion-dom',
  'motion-utils',
  'react-hook-form',
  'three',
  'workbox-window',
  'zustand',
];

const THIRD_PARTY_LICENSES_FILE_NAME = 'third-party-licenses.txt';

const WORKBOX_RESOLVE_CHAIN = ['vite-plugin-pwa', 'workbox-build'];

const EXTRA_LICENSE_PACKAGES = [
  { name: '@fontsource-variable/manrope', resolveFrom: [] },
  { name: 'tailwindcss', resolveFrom: [] },
  { name: 'vite', resolveFrom: [] },
  { name: 'rolldown', resolveFrom: ['vite'] },
  { name: 'workbox-core', resolveFrom: WORKBOX_RESOLVE_CHAIN },
  { name: 'workbox-precaching', resolveFrom: WORKBOX_RESOLVE_CHAIN },
  { name: 'workbox-routing', resolveFrom: WORKBOX_RESOLVE_CHAIN },
  { name: 'workbox-strategies', resolveFrom: WORKBOX_RESOLVE_CHAIN },
];

const APP_NAME_MESSAGE_KEY = 'app.productName';

const START_ERROR_MESSAGE_KEY = 'app.startError.message';

const RELOAD_MESSAGE_KEY = 'routing.chunkError.reload';

const profile = loadBuildProfile({
  appRoot: import.meta.dirname,
  profileName: process.env.BUILD_PROFILE ?? DEFAULT_PROFILE_NAME,
});

const profileMessages = await loadProfileMessages({
  appRoot: import.meta.dirname,
  keys: [APP_NAME_MESSAGE_KEY, START_ERROR_MESSAGE_KEY, RELOAD_MESSAGE_KEY],
  profile,
});

const appName = profileMessages[APP_NAME_MESSAGE_KEY];

const appVersion = resolveAppVersion({ readGitHead: createGitHeadReader(import.meta.dirname) });

const thirdPartyLicenses = createThirdPartyLicenses({
  allowedLicenses: ALLOWED_BUNDLE_LICENSES,
  appRoot: import.meta.dirname,
  extraPackages: EXTRA_LICENSE_PACKAGES,
  fileName: THIRD_PARTY_LICENSES_FILE_NAME,
  supplementalNotices: {
    '@bwip-js/generic@4.11.4': readFileSync(
      new URL('./build-licenses/notices/bwip-js.BWIPP-and-stb.LICENSE.txt', import.meta.url),
      'utf8',
    ).trim(),
    'zxing-wasm@3.1.6': readFileSync(
      new URL('./build-licenses/notices/zxing-wasm.READER.LICENSE.txt', import.meta.url),
      'utf8',
    ).trim(),
  },
});

const criticalPreload = createCriticalPreload({
  deferredEntries: DEFERRED_PRELOAD_ENTRIES,
  entries: CRITICAL_PATH_ENTRIES,
  isDemoTransport,
  workerDynamicEntries: ENGINE_WORKER_DYNAMIC_ENTRIES,
  workerEntries: ENGINE_WORKER_ENTRIES,
});

const previewCacheControl = process.env.PERF_PREVIEW_CACHE_CONTROL;

const devHttps = resolveDevHttps(loadEnv('development', import.meta.dirname, DEV_HTTPS_ENV_PREFIX), readFileSync);

export default defineConfig({
  base: APP_BASE_PATH,
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: 'react', priority: 2, test: /[\\/]node_modules[\\/]react[\\/]/ },
            { name: 'zustand', priority: 1, test: /[\\/]node_modules[\\/]zustand[\\/]esm[\\/](?:index|vanilla|react)\.mjs$/ },
            {
              includeDependenciesRecursively: false,
              name: 'hud-shared',
              test: (moduleId: string): boolean => HUD_SHARED_MODULES.some(entry => hasEntryModule([moduleId], entry)),
            },
            {
              includeDependenciesRecursively: false,
              name: 'startup-contract',
              test: (moduleId: string): boolean => STARTUP_CONTRACT_MODULES.some(entry => hasEntryModule([moduleId], entry)),
            },
            {
              includeDependenciesRecursively: false,
              name: 'catalog-contract',
              test: (moduleId: string): boolean => CATALOG_CONTRACT_MODULES.some(entry => hasEntryModule([moduleId], entry)),
            },
            {
              includeDependenciesRecursively: false,
              name: 'listing-shared',
              test: (moduleId: string): boolean => LISTING_SHARED_MODULES.some(entry => hasEntryModule([moduleId], entry)),
            },
            {
              includeDependenciesRecursively: false,
              name: 'organization-contract',
              test: (moduleId: string): boolean => ORGANIZATION_CONTRACT_MODULES.some(entry => hasEntryModule([moduleId], entry)),
            },
            {
              includeDependenciesRecursively: false,
              name: 'catalog-edit-shared',
              test: (moduleId: string): boolean => CATALOG_EDIT_SHARED_MODULES.some(entry => hasEntryModule([moduleId], entry)),
            },
            {
              includeDependenciesRecursively: false,
              name: 'create-warehouse-recovery',
              test: (moduleId: string): boolean =>
                hasEntryModule([moduleId], 'src/features/create-warehouse/ui/CreateWarehouseRecoveryNotice.tsx'),
            },
            {
              includeDependenciesRecursively: false,
              name: 'organization-badges',
              test: (moduleId: string): boolean => ORGANIZATION_BADGE_MODULES.some(entry => hasEntryModule([moduleId], entry)),
            },
            {
              includeDependenciesRecursively: false,
              name: 'organization-showcase-utils',
              test: /[\\/]pages[\\/]network[\\/](?:api[\\/]organizationShowcaseKeys|lib[\\/]sortOrganizationProfiles)\.ts$/u,
            },
            {
              includeDependenciesRecursively: false,
              name: 'warehouse-scanner',
              test: (moduleId: string): boolean =>
                /[\\/]warehouse[\\/]model[\\/]scan[\\/](?:keyboardScan|parseWarehouseScan|readScannedCell|resolveReceivingScan)\.ts$/u
                  .test(moduleId) || hasEntryModule([moduleId], 'src/pages/warehouse/ui/workspace/WarehouseScanInput.tsx'),
            },
            {
              includeDependenciesRecursively: false,
              name: 'deal-form-shared',
              test: (moduleId: string): boolean => DEAL_FORM_MODULES.some(entry => hasEntryModule([moduleId], entry)),
            },
            {
              includeDependenciesRecursively: false,
              name: 'deal-command-access',
              test: (moduleId: string): boolean => DEAL_COMMAND_ACCESS_MODULES.some(entry => hasEntryModule([moduleId], entry)),
            },
            {
              includeDependenciesRecursively: false,
              name: 'deal-command-context',
              test: (moduleId: string): boolean => DEAL_COMMAND_CONTEXT_MODULES.some(entry => hasEntryModule([moduleId], entry)),
            },
            {
              includeDependenciesRecursively: false,
              name: 'deal-document-format',
              test: (moduleId: string): boolean => DEAL_DOCUMENT_FORMAT_MODULES.some(entry => hasEntryModule([moduleId], entry)),
            },
            {
              includeDependenciesRecursively: false,
              name: 'deal-query-scope',
              test: (moduleId: string): boolean => hasEntryModule([moduleId], 'src/pages/deals/api/dealQueryScope.ts'),
            },
            {
              includeDependenciesRecursively: false,
              name: 'deal-status',
              test: (moduleId: string): boolean => DEAL_STATUS_MODULES.some(entry => hasEntryModule([moduleId], entry)),
            },
            {
              includeDependenciesRecursively: false,
              name: 'deal-line-labels',
              test: (moduleId: string): boolean => hasEntryModule([moduleId], 'src/pages/deals/ui/inspector/dealLineLabels.ts'),
            },
            {
              includeDependenciesRecursively: false,
              name: 'money-format',
              test: (moduleId: string): boolean => MONEY_FORMAT_MODULES.some(entry => hasEntryModule([moduleId], entry)),
            },
            {
              includeDependenciesRecursively: false,
              name: 'tooltip',
              test: (moduleId: string): boolean => TOOLTIP_SHARED_PACKAGES.has(extractPackageName(moduleId) ?? '')
                || TOOLTIP_SHARED_MODULES.some(entry => hasEntryModule([moduleId], entry)),
            },
            {
              includeDependenciesRecursively: false,
              name: 'side-shape',
              test: (moduleId: string): boolean => SIDE_SHAPE_MODULES.some(entry => hasEntryModule([moduleId], entry)),
            },
            {
              includeDependenciesRecursively: false,
              name: 'list-helpers',
              test: (moduleId: string): boolean => LIST_HELPER_MODULES.some(entry => hasEntryModule([moduleId], entry)),
            },
          ],
        },
      },
      treeshake: {
        manualPureFunctions: ['console.log', 'console.info', 'console.debug'],
      },
    },
  },
  plugins: [
    buildProfilePlugin({ appName, profile }),
    appVersionPlugin({ appVersion }),
    themeBootScriptPlugin(),
    bootFallbackPlugin({
      messages: { message: profileMessages[START_ERROR_MESSAGE_KEY], reload: profileMessages[RELOAD_MESSAGE_KEY] },
    }),
    react(),
    tailwindcss(),
    VitePWA({
      devOptions: { enabled: false },
      includeManifestIcons: false,
      injectRegister: false,
      manifest: {
        background_color: MANIFEST_BACKGROUND_COLOR,
        display: 'standalone',
        icons: APP_ICONS.filter(isManifestIcon).map(icon => ({
          purpose: icon.purpose,
          sizes: getIconSizes(icon),
          src: icon.fileName,
          type: 'image/png',
        })),
        id: APP_BASE_PATH,
        lang: profile.defaultTenant.defaultLocale,
        name: appName,
        short_name: appName,
        theme_color: THEME_COLOR_BY_THEME.light,
      },
      registerType: 'prompt',
      workbox: {
        cleanupOutdatedCaches: true,
        globPatterns: PRECACHE_GLOB_PATTERNS,
        maximumFileSizeToCacheInBytes: MAX_PRECACHED_FILE_BYTES,
        navigateFallback: 'index.html',
        navigateFallbackDenylist: NAVIGATE_FALLBACK_DENYLIST,
      },
    }),
    bundleBudgetPlugin({
      assetBudgets: ASSET_BUDGETS,
      forbiddenInitialPackages: FORBIDDEN_INITIAL_PACKAGES,
      forbiddenPackages: FORBIDDEN_PACKAGES,
      lazyEntryBudgets: LAZY_ENTRY_BUDGETS,
      maxInitialGzipKiloBytes: MAX_INITIAL_GZIP_KILOBYTES,
    }),
    thirdPartyLicenses.plugin,
    criticalPreload.plugin,
  ],
  preview: previewCacheControl === undefined || previewCacheControl === ''
    ? {}
    : { headers: { 'Cache-Control': previewCacheControl } },
  resolve: {
    tsconfigPaths: true,
  },
  server: {
    ...devHttps === undefined ? {} : { host: true, https: devHttps },
    port: 5173,
    strictPort: true,
  },
  worker: {
    format: 'es',
    plugins: () => [
      thirdPartyLicenses.workerPlugin(),
      removeUnusedBarcodeFonts(),
      criticalPreload.workerPlugin(),
      bundleBudgetPlugin(ENGINE_WORKER_BUDGET),
      bundleBudgetPlugin(PRINT_WORKER_BUDGET),
      bundleBudgetPlugin(CAMERA_WORKER_BUDGET),
    ],
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [{
            includeDependenciesRecursively: false,
            name: 'worker-runtime',
            tags: ['$initial'],
            test: (moduleId: string): boolean => !ENGINE_WORKER_ENTRIES.some(entry => hasEntryModule([moduleId], entry)),
          }, {
            name: 'engine-runtime',
            test: (moduleId: string): boolean => hasEntryModule([moduleId], 'packages/demo-engine/src/core/engine/createEngine.ts'),
          }, {
            includeDependenciesRecursively: false,
            name: 'engine-seed-topologies',
            test: /[\\/]core[\\/](?:engine[\\/]migrateWarehouseTopologies|seed[\\/]seed(?:SnapshotWithTopology|WarehouseTopologies))\.ts$/,
          }, {
            includeDependenciesRecursively: false,
            name: 'engine-transport-shared',
            test: /[\\/]core[\\/]modules[\\/]logistics[\\/]transport(?:Events|Matching)\.ts$/,
          }, {
            includeDependenciesRecursively: false,
            name: 'engine-payment-lifecycle',
            test: /[\\/]core[\\/]modules[\\/]payments[\\/](?:index|paymentLifecycle|paymentMachine|paymentService)\.ts$/,
          }, {
            includeDependenciesRecursively: false,
            name: 'engine-invoiced-payment',
            test: /[\\/]core[\\/]modules[\\/]payments[\\/](?:invoicedPayment|paymentRules)\.ts$/,
          }],
        },
      },
      treeshake: {
        manualPureFunctions: ['console.log', 'console.info', 'console.debug'],
      },
    },
  },
});
