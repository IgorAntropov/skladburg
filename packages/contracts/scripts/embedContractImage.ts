import {
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';

import { renderContractImageModule } from './renderContractImageModule.ts';

const generatedDirectory = join(import.meta.dirname, '..', 'src', 'gen');

writeFileSync(
  join(generatedDirectory, 'contract_image.ts'),
  renderContractImageModule(readFileSync(join(generatedDirectory, 'contract_runtime.binpb'))),
);
