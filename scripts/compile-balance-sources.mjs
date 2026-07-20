import { readFile, rename, writeFile } from 'node:fs/promises';
import { isDeepStrictEqual } from 'node:util';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_GAME_PACK_DIR = path.resolve(scriptDir, '../games/zhaoyun-adou');

export const BALANCE_SOURCE_DEFINITIONS = Object.freeze([
  Object.freeze({
    file: 'economy.json',
    sections: Object.freeze([
      '$schema', 'schemaVersion', 'version', 'recruitCost', 'gachaWeights', 'gachaPairing',
    ]),
  }),
  Object.freeze({
    file: 'pieces.json',
    sections: Object.freeze(['troops', 'levelMult', 'maxLevel']),
  }),
  Object.freeze({
    file: 'heroes-skills.json',
    sections: Object.freeze(['heroes', 'skills']),
  }),
  Object.freeze({
    file: 'encounter.json',
    sections: Object.freeze(['enemy', 'waves']),
  }),
  Object.freeze({
    file: 'items.json',
    sections: Object.freeze(['items']),
  }),
]);

export const BALANCE_SECTION_ORDER = Object.freeze(
  BALANCE_SOURCE_DEFINITIONS.flatMap(({ sections }) => sections),
);

const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

// JSON.parse 会静默覆盖重复键，因此在解析前扫描每一层对象键。
const assertNoDuplicateObjectKeys = (text, sourcePath) => {
  const stack = [];

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === '{') {
      stack.push({ type: 'object', keys: new Set() });
      continue;
    }
    if (char === '}') {
      stack.pop();
      continue;
    }
    if (char === '[') {
      stack.push({ type: 'array' });
      continue;
    }
    if (char === ']') {
      stack.pop();
      continue;
    }
    if (char !== '"') continue;

    const start = index;
    index += 1;
    while (index < text.length) {
      if (text[index] === '\\') {
        index += 2;
        continue;
      }
      if (text[index] === '"') break;
      index += 1;
    }
    if (index >= text.length) break;

    let lookahead = index + 1;
    while (/\s/.test(text[lookahead] ?? '')) lookahead += 1;
    const context = stack.at(-1);
    if (text[lookahead] === ':' && context?.type === 'object') {
      const key = JSON.parse(text.slice(start, index + 1));
      if (context.keys.has(key)) {
        const location = stack.length === 1 ? 'top-level key' : 'key';
        throw new Error(`[balance-sources] duplicate ${location} "${key}" in ${sourcePath}`);
      }
      context.keys.add(key);
    }
  }
};

const readSourceDocument = async (sourcePath) => {
  let text;
  try {
    text = await readFile(sourcePath, 'utf8');
  } catch (error) {
    throw new Error(`[balance-sources] cannot read source ${sourcePath}: ${error.message}`);
  }

  assertNoDuplicateObjectKeys(text, sourcePath);
  try {
    const document = JSON.parse(text);
    if (!isRecord(document)) {
      throw new Error('root must be a JSON object');
    }
    return document;
  } catch (error) {
    throw new Error(`[balance-sources] invalid JSON in ${sourcePath}: ${error.message}`);
  }
};

const resolvePaths = ({
  gamePackDir = DEFAULT_GAME_PACK_DIR,
  sourceDir = path.join(gamePackDir, 'sources/balance'),
  outputPath = path.join(gamePackDir, 'balance.json'),
} = {}) => ({
  gamePackDir: path.resolve(gamePackDir),
  sourceDir: path.resolve(sourceDir),
  outputPath: path.resolve(outputPath),
});

export const compileBalanceSources = async (options = {}) => {
  const { sourceDir } = resolvePaths(options);
  const documents = [];

  for (const definition of BALANCE_SOURCE_DEFINITIONS) {
    const sourcePath = path.join(sourceDir, definition.file);
    documents.push({
      ...definition,
      sourcePath,
      document: await readSourceDocument(sourcePath),
    });
  }

  const values = new Map();
  const declaredBy = new Map();
  for (const { file, document } of documents) {
    for (const [section, value] of Object.entries(document)) {
      if (values.has(section)) {
        throw new Error(
          `[balance-sources] duplicate section "${section}" in ${declaredBy.get(section)} and ${file}`,
        );
      }
      values.set(section, value);
      declaredBy.set(section, file);
    }
  }

  const knownSections = new Set(BALANCE_SECTION_ORDER);
  for (const [section, file] of declaredBy) {
    if (!knownSections.has(section)) {
      throw new Error(`[balance-sources] unknown section "${section}" in ${file}`);
    }
  }

  for (const { file, sections } of BALANCE_SOURCE_DEFINITIONS) {
    const expected = new Set(sections);
    for (const section of sections) {
      if (!values.has(section)) {
        throw new Error(`[balance-sources] missing section "${section}" from ${file}`);
      }
    }
    for (const [section, declaredFile] of declaredBy) {
      if (declaredFile === file && !expected.has(section)) {
        const owner = BALANCE_SOURCE_DEFINITIONS.find((entry) => entry.sections.includes(section));
        throw new Error(
          `[balance-sources] section "${section}" belongs to ${owner.file}, not ${file}`,
        );
      }
    }
  }

  // 根字段顺序由编译器固定，不受人工源内容重排影响。
  return Object.fromEntries(BALANCE_SECTION_ORDER.map((section) => [section, values.get(section)]));
};

export const stringifyBalanceManifest = (manifest) => `${JSON.stringify(manifest, null, 2)}\n`;

const firstDifferentSection = (expected, actual) => (
  BALANCE_SECTION_ORDER.find((section) => !isDeepStrictEqual(expected?.[section], actual?.[section]))
  ?? Object.keys(actual ?? {}).find((section) => !BALANCE_SECTION_ORDER.includes(section))
  ?? 'root'
);

export const checkBalanceSources = async (options = {}) => {
  const paths = resolvePaths(options);
  const expected = await compileBalanceSources(paths);
  let actual;
  try {
    actual = JSON.parse(await readFile(paths.outputPath, 'utf8'));
  } catch (error) {
    throw new Error(`[balance-sources] cannot read compiled manifest ${paths.outputPath}: ${error.message}`);
  }

  if (!isDeepStrictEqual(actual, expected)) {
    const section = firstDifferentSection(expected, actual);
    throw new Error(
      `[balance-sources] balance manifest is out of sync at section "${section}"; run with --write`,
    );
  }
  return { manifest: expected, outputPath: paths.outputPath };
};

export const writeBalanceManifest = async (options = {}) => {
  const paths = resolvePaths(options);
  const manifest = await compileBalanceSources(paths);
  const temporaryPath = `${paths.outputPath}.tmp-${process.pid}`;
  await writeFile(temporaryPath, stringifyBalanceManifest(manifest));
  await rename(temporaryPath, paths.outputPath);
  return { manifest, outputPath: paths.outputPath };
};

const parseArguments = (args) => {
  const options = {};
  let mode = 'check';
  let explicitMode = false;

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === '--check' || argument === '--write') {
      const nextMode = argument.slice(2);
      if (explicitMode && mode !== nextMode) {
        throw new Error('[balance-sources] choose exactly one of --check or --write');
      }
      mode = nextMode;
      explicitMode = true;
      continue;
    }
    if (argument === '--game-dir' || argument === '--source-dir' || argument === '--output') {
      const value = args[index + 1];
      if (!value || value.startsWith('--')) {
        throw new Error(`[balance-sources] ${argument} requires a path`);
      }
      index += 1;
      if (argument === '--game-dir') options.gamePackDir = value;
      if (argument === '--source-dir') options.sourceDir = value;
      if (argument === '--output') options.outputPath = value;
      continue;
    }
    throw new Error(`[balance-sources] unknown argument "${argument}"`);
  }

  return { mode, options };
};

const runCli = async () => {
  const { mode, options } = parseArguments(process.argv.slice(2));
  const result = mode === 'write'
    ? await writeBalanceManifest(options)
    : await checkBalanceSources(options);
  console.log(
    mode === 'write'
      ? `generated ${result.outputPath}`
      : `✓ balance sources synchronized: ${result.outputPath}`,
  );
};

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  runCli().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
