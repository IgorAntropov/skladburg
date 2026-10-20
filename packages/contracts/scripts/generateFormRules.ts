import {
  createFileRegistry,
  fromBinary,
} from '@bufbuild/protobuf';
import { FileDescriptorSetSchema } from '@bufbuild/protobuf/wkt';
import {
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import {
  dirname,
  join,
  relative,
  sep,
} from 'node:path';

import { readFileFormRules } from './readFormRules.ts';
import { renderFormRulesModule } from './renderFormRulesModule.ts';

const EXTERNAL_FILE_PREFIXES: readonly string[] = ['buf/validate/', 'google/'];

const sourceDirectory = join(import.meta.dirname, '..', 'src');
const generatedFormsDirectory = join(sourceDirectory, 'gen', 'forms');
const formsIndexPath = join(sourceDirectory, 'forms', 'index');

const toImportPath = (fromDirectory: string): string => {
  const importPath = relative(fromDirectory, formsIndexPath).split(sep).join('/');

  return importPath.startsWith('.') ? importPath : `./${importPath}`;
};

const registry = createFileRegistry(
  fromBinary(FileDescriptorSetSchema, readFileSync(join(sourceDirectory, 'gen', 'contract.binpb'))),
);

const contractFiles = [...registry.files]
  .filter(file => !EXTERNAL_FILE_PREFIXES.some(prefix => file.name.startsWith(prefix)))
  .toSorted((current, next) => current.name.localeCompare(next.name));

rmSync(generatedFormsDirectory, { force: true, recursive: true });

for (const file of contractFiles) {
  const messages = readFileFormRules(file);

  if (messages.length === 0) {
    continue;
  }

  const outputPath = join(generatedFormsDirectory, `${file.name.replace(/\.proto$/, '')}_rules.ts`);

  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, renderFormRulesModule(messages, toImportPath(dirname(outputPath))));
}
