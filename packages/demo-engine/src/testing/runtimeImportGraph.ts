import {
  existsSync,
  readFileSync,
} from 'node:fs';
import {
  dirname,
  resolve,
} from 'node:path';
import ts from 'typescript';

const SOURCE_EXTENSION = '.ts';

const resolveRelativeModule = (importerPath: string, specifier: string): string | undefined => {
  const base = resolve(dirname(importerPath), specifier);
  const candidates = [`${base}${SOURCE_EXTENSION}`, resolve(base, `index${SOURCE_EXTENSION}`)];

  return candidates.find(candidate => existsSync(candidate));
};

const readRuntimeSpecifiers = (filePath: string): string[] => {
  const source = ts.createSourceFile(filePath, readFileSync(filePath, 'utf8'), ts.ScriptTarget.ES2023, true);
  const specifiers: string[] = [];

  for (const statement of source.statements) {
    if (ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier)) {
      if (statement.importClause?.phaseModifier !== ts.SyntaxKind.TypeKeyword) {
        specifiers.push(statement.moduleSpecifier.text);
      }
    }
    else if (ts.isExportDeclaration(statement) && !statement.isTypeOnly) {
      if (statement.moduleSpecifier !== undefined && ts.isStringLiteral(statement.moduleSpecifier)) {
        specifiers.push(statement.moduleSpecifier.text);
      }
    }
  }

  return specifiers;
};

export const collectRuntimeModules = (entryPath: string): string[] => {
  const visited = new Set<string>();
  const pending = [entryPath];

  while (pending.length > 0) {
    const current = pending.pop();

    if (current === undefined || visited.has(current)) {
      continue;
    }

    visited.add(current);

    for (const specifier of readRuntimeSpecifiers(current)) {
      const resolved = specifier.startsWith('.') ? resolveRelativeModule(current, specifier) : undefined;

      if (resolved !== undefined) {
        pending.push(resolved);
      }
    }
  }

  return [...visited].sort();
};
