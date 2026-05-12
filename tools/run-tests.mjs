import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';

const collectTestFiles = (directory) => {
  const entries = readdirSync(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const absolutePath = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectTestFiles(absolutePath));
      continue;
    }

    if (entry.isFile() && entry.name.endsWith('.test.ts')) {
      files.push(absolutePath);
    }
  }

  return files;
};

const testFiles = collectTestFiles(join(process.cwd(), 'src')).sort();

if (testFiles.length === 0) {
  console.log('No test files found.');
  process.exit(0);
}

const result = spawnSync(
  process.execPath,
  ['--import', 'tsx', '--test', ...testFiles],
  {
    stdio: 'inherit',
  }
);

if (typeof result.status === 'number') {
  process.exit(result.status);
}

process.exit(1);
