import {
  copyFileSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import {
  join,
  relative,
} from 'node:path';
import { parseArgs } from 'node:util';

import type { ModelReportValue } from './convertModel.ts';

import {
  buildWorldModelPath,
  WORLD_MODEL_CATALOG,
} from '../src/pages/network/scene/models/worldModelCatalog.ts';
import { convertGlbToWorldModel } from './convertModel.ts';
import { decodePng } from './decodePng.ts';

const appRoot = join(import.meta.dirname, '..');

const OUTPUT_DIRECTORY = join(appRoot, 'public', 'models');

const GLB_DIRECTORY = join('Models', 'GLB format');

const COLORMAP_PATH = join(GLB_DIRECTORY, 'Textures', 'colormap.png');

const LICENSE_FILE = 'License.txt';

const BIN_EXTENSION = '.bin';

const BUDGET_BYTES = 300_000;

const KITS = ['commercial', 'industrial'] as const;

const listBinFiles = (directory: string): string[] => readdirSync(directory, { recursive: true, withFileTypes: true })
  .filter(entry => entry.isFile() && entry.name.endsWith(BIN_EXTENSION))
  .map(entry => join(entry.parentPath, entry.name));

const readOptions = (): Record<(typeof KITS)[number], string> & { report: string | undefined } => {
  const { values } = parseArgs({
    allowPositionals: false,
    args: process.argv.slice(2).filter(argument => argument !== '--'),
    options: {
      commercial: { type: 'string' },
      industrial: { type: 'string' },
      report: { type: 'string' },
    },
  });

  if (values.commercial === undefined || values.industrial === undefined) {
    throw new Error('Usage: models --commercial <dir> --industrial <dir> [--report <path>]');
  }

  return { commercial: values.commercial, industrial: values.industrial, report: values.report };
};

const convert = (): void => {
  const options = readOptions();
  const reports: Record<string, ModelReportValue> = {};
  const expectedFiles = new Set<string>();
  let totalBytes = 0;

  for (const kit of KITS) {
    const kitDirectory = options[kit];
    const colormap = decodePng(readFileSync(join(kitDirectory, COLORMAP_PATH)));

    mkdirSync(join(OUTPUT_DIRECTORY, kit), { recursive: true });
    copyFileSync(join(kitDirectory, LICENSE_FILE), join(OUTPUT_DIRECTORY, kit, LICENSE_FILE));

    for (const entry of WORLD_MODEL_CATALOG.filter(item => item.kit === kit)) {
      const glb = readFileSync(join(kitDirectory, GLB_DIRECTORY, `${entry.sourceName}.glb`));
      const { bytes, report } = convertGlbToWorldModel(glb, colormap);
      const outputPath = join(appRoot, 'public', buildWorldModelPath(entry));

      writeFileSync(outputPath, bytes);
      expectedFiles.add(outputPath);
      reports[entry.id] = report;
      totalBytes += bytes.length;
      console.log('> convertWorldModels -> convert:', { id: entry.id, ...report });
    }
  }

  const removedFiles = listBinFiles(OUTPUT_DIRECTORY).filter(path => !expectedFiles.has(path));

  for (const path of removedFiles) {
    rmSync(path);
  }

  const summary = {
    budgetBytes: BUDGET_BYTES,
    models: expectedFiles.size,
    removedFiles: removedFiles.map(path => relative(OUTPUT_DIRECTORY, path)),
    totalBytes,
  };

  console.log('> convertWorldModels -> convert:', summary);

  if (options.report !== undefined) {
    writeFileSync(options.report, `${JSON.stringify({ models: reports, summary }, null, 2)}\n`);
  }
};

convert();
