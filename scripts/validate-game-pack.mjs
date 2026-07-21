#!/usr/bin/env node
import { access, readFile } from 'node:fs/promises';
import { dirname, extname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const DEFAULT_PACK_DIR = resolve(SCRIPT_DIR, '../games/zhaoyun-adou');

const MANIFEST_FILES = {
  game: 'game.json',
  balance: 'balance.json',
  levels: 'levels.json',
  copy: 'copy.zh-CN.json',
  theme: 'theme.json',
  assets: 'assets.json',
  audio: 'audio.json',
  events: 'events.json',
};

const SCHEMA_FILES = Object.fromEntries(
  Object.entries(MANIFEST_FILES).map(([key, file]) => [key, `${file.replace(/\.json$/, '')}.schema.json`]),
);

const REQUIRED_EVENT_IDS = [
  'session_start', 'session_end', 'stage_start', 'stage_end',
  'recruit_attempt', 'recruit_result', 'deploy', 'merge',
  'hero_unlock', 'hero_cast', 'wave_start', 'wave_end',
  'enemy_leak', 'invalid_action', 'retry', 'quit',
];

const REQUIRED_EVENT_FIELDS = [
  'gameVersion', 'rulesetVersion', 'contentVersion', 'reason',
];

const valueType = (value) => {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
};

const equalJson = (left, right) => JSON.stringify(left) === JSON.stringify(right);

function resolvePointer(root, reference) {
  if (!reference.startsWith('#/')) throw new Error(`不支持的 Schema $ref: ${reference}`);
  return reference.slice(2).split('/').reduce((value, rawPart) => {
    const part = rawPart.replace(/~1/g, '/').replace(/~0/g, '~');
    return value?.[part];
  }, root);
}

function matchesType(value, expected) {
  if (expected === 'integer') return Number.isInteger(value);
  if (expected === 'number') return typeof value === 'number' && Number.isFinite(value);
  return valueType(value) === expected;
}

// 实现本项目 Schema 所用的 Draft 2020-12 关键子集，保持零依赖。
export function validateAgainstSchema(value, schema, path = '$', root = schema, errors = []) {
  if (!schema || typeof schema !== 'object') {
    errors.push(`${path}: Schema 节点无效`);
    return errors;
  }
  if (schema.$ref) {
    const resolved = resolvePointer(root, schema.$ref);
    if (!resolved) errors.push(`${path}: 无法解析 Schema $ref ${schema.$ref}`);
    else validateAgainstSchema(value, resolved, path, root, errors);
    return errors;
  }
  if ('const' in schema && !equalJson(value, schema.const)) {
    errors.push(`${path}: 必须等于 ${JSON.stringify(schema.const)}`);
  }
  if (schema.enum && !schema.enum.some((entry) => equalJson(entry, value))) {
    errors.push(`${path}: ${JSON.stringify(value)} 不在允许值 ${JSON.stringify(schema.enum)} 中`);
  }
  if (schema.type) {
    const expected = Array.isArray(schema.type) ? schema.type : [schema.type];
    if (!expected.some((type) => matchesType(value, type))) {
      errors.push(`${path}: 期望 ${expected.join('|')}，实际为 ${valueType(value)}`);
      return errors;
    }
  }

  if (typeof value === 'string') {
    if (schema.minLength !== undefined && value.length < schema.minLength) {
      errors.push(`${path}: 长度不能小于 ${schema.minLength}`);
    }
    if (schema.pattern && !(new RegExp(schema.pattern)).test(value)) {
      errors.push(`${path}: ${JSON.stringify(value)} 不匹配 ${schema.pattern}`);
    }
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    if (schema.minimum !== undefined && value < schema.minimum) {
      errors.push(`${path}: ${value} 不能小于 ${schema.minimum}`);
    }
    if (schema.exclusiveMinimum !== undefined && value <= schema.exclusiveMinimum) {
      errors.push(`${path}: ${value} 必须大于 ${schema.exclusiveMinimum}`);
    }
    if (schema.maximum !== undefined && value > schema.maximum) {
      errors.push(`${path}: ${value} 不能大于 ${schema.maximum}`);
    }
  }

  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) {
      errors.push(`${path}: 至少需要 ${schema.minItems} 项`);
    }
    if (schema.maxItems !== undefined && value.length > schema.maxItems) {
      errors.push(`${path}: 最多允许 ${schema.maxItems} 项`);
    }
    if (schema.uniqueItems) {
      const keys = value.map((entry) => JSON.stringify(entry));
      if (new Set(keys).size !== keys.length) errors.push(`${path}: 不允许重复项`);
    }
    if (schema.items) {
      value.forEach((entry, index) => validateAgainstSchema(entry, schema.items, `${path}[${index}]`, root, errors));
    }
  }

  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const keys = Object.keys(value);
    if (schema.minProperties !== undefined && keys.length < schema.minProperties) {
      errors.push(`${path}: 至少需要 ${schema.minProperties} 个字段`);
    }
    for (const required of schema.required ?? []) {
      if (!Object.hasOwn(value, required)) errors.push(`${path}.${required}: 缺少必填字段`);
    }
    for (const key of keys) {
      const childPath = `${path}.${key}`;
      let matched = false;
      if (schema.properties?.[key]) {
        matched = true;
        validateAgainstSchema(value[key], schema.properties[key], childPath, root, errors);
      }
      for (const [pattern, childSchema] of Object.entries(schema.patternProperties ?? {})) {
        if ((new RegExp(pattern)).test(key)) {
          matched = true;
          validateAgainstSchema(value[key], childSchema, childPath, root, errors);
        }
      }
      if (!matched && schema.additionalProperties === false) {
        errors.push(`${childPath}: 不允许的字段`);
      } else if (!matched && schema.additionalProperties && typeof schema.additionalProperties === 'object') {
        validateAgainstSchema(value[key], schema.additionalProperties, childPath, root, errors);
      }
    }
  }
  return errors;
}

async function readJson(path, label) {
  let source;
  try {
    source = await readFile(path, 'utf8');
  } catch (error) {
    throw new Error(`${label}: 无法读取 (${error.code ?? error.message})`);
  }
  try {
    return JSON.parse(source);
  } catch (error) {
    throw new Error(`${label}: JSON 语法错误 (${error.message})`);
  }
}

export async function loadGamePackDirectory(packDir = DEFAULT_PACK_DIR) {
  const directory = resolve(packDir);
  const documents = {};
  const schemas = {};
  for (const [key, file] of Object.entries(MANIFEST_FILES)) {
    documents[key] = await readJson(resolve(directory, file), file);
    schemas[key] = await readJson(resolve(directory, 'schemas', SCHEMA_FILES[key]), `schemas/${SCHEMA_FILES[key]}`);
  }
  return { packDir: directory, documents, schemas };
}

function addReferenceError(errors, path, id, registry, label) {
  if (!Object.hasOwn(registry, id)) errors.push(`${path}: 未找到${label} ${JSON.stringify(id)}`);
}

function ensureUnique(errors, values, path, label = 'ID') {
  const seen = new Set();
  values.forEach((value, index) => {
    if (seen.has(value)) errors.push(`${path}[${index}]: ${label} ${JSON.stringify(value)} 重复`);
    seen.add(value);
  });
}

const cellKey = (cell) => `${cell.r},${cell.c}`;
const sameCell = (left, right) => left?.r === right?.r && left?.c === right?.c;

function validateMap(errors, mapId, map, board) {
  const basePath = `levels.maps.${mapId}`;
  const inBounds = (cell) => Number.isInteger(cell?.r) && Number.isInteger(cell?.c)
    && cell.r >= 0 && cell.r < board.rows && cell.c >= 0 && cell.c < board.cols;
  const laneCells = new Set();

  map.lanes?.forEach((lane, laneIndex) => {
    const path = `${basePath}.lanes[${laneIndex}]`;
    const local = new Set();
    lane.forEach((cell, index) => {
      const key = cellKey(cell);
      if (!inBounds(cell)) errors.push(`${path}[${index}]: 坐标 (${key}) 超出 ${board.rows}×${board.cols} 棋盘`);
      if (local.has(key)) errors.push(`${path}[${index}]: 同一路线重复经过 (${key})`);
      if (laneCells.has(key)) errors.push(`${path}[${index}]: 与其他路线相交于 (${key})`);
      local.add(key);
      laneCells.add(key);
      if (index > 0) {
        const previous = lane[index - 1];
        const distance = Math.abs(cell.r - previous.r) + Math.abs(cell.c - previous.c);
        if (distance !== 1) errors.push(`${path}[${index}]: 与前一格不是四向相邻`);
      }
    });
    if (!sameCell(map.spawnCells?.[laneIndex], lane[0])) {
      errors.push(`${basePath}.spawnCells[${laneIndex}]: 必须等于路线起点`);
    }
    if (!sameCell(map.gateCells?.[laneIndex], lane.at(-1))) {
      errors.push(`${basePath}.gateCells[${laneIndex}]: 必须等于路线终点`);
    }
  });

  if (map.spawnCells?.length !== map.lanes?.length) errors.push(`${basePath}.spawnCells: 数量必须与路线数一致`);
  if (map.gateCells?.length !== map.lanes?.length) errors.push(`${basePath}.gateCells: 数量必须与路线数一致`);
  if (map.legacyPathLane >= (map.lanes?.length ?? 0)) errors.push(`${basePath}.legacyPathLane: 指向不存在的路线`);

  const openKeys = new Set();
  map.openCells?.forEach((cell, index) => {
    const key = cellKey(cell);
    if (!inBounds(cell)) errors.push(`${basePath}.openCells[${index}]: 坐标 (${key}) 超出棋盘`);
    if (openKeys.has(key)) errors.push(`${basePath}.openCells[${index}]: 开放格 (${key}) 重复`);
    if (laneCells.has(key)) errors.push(`${basePath}.openCells[${index}]: 与行军路线 (${key}) 冲突`);
    openKeys.add(key);
  });
  const hasHorizontalPair = [...openKeys].some((key) => {
    const [r, c] = key.split(',').map(Number);
    return openKeys.has(`${r},${c + 1}`);
  });
  if (!hasHorizontalPair) errors.push(`${basePath}.openCells: 至少需要一组水平相邻格以支持双字合将`);

  if (map.symmetry === 'rotate-180') {
    if (map.lanes?.length !== 2) {
      errors.push(`${basePath}.lanes: rotate-180 地图必须恰有两条路线`);
    } else {
      map.lanes[0].forEach((cell, index) => {
        const expected = { r: board.rows - 1 - cell.r, c: board.cols - 1 - cell.c };
        if (!sameCell(map.lanes[1][index], expected)) {
          errors.push(`${basePath}.lanes[1][${index}]: 应为第一路同位格的 180° 旋转 (${cellKey(expected)})`);
        }
      });
      if (map.lanes[0].length !== map.lanes[1].length) errors.push(`${basePath}.lanes: 旋转对称路线必须等长`);
    }
  }
}

export function validateGamePackDocuments(documents, schemas) {
  const errors = [];
  for (const key of Object.keys(MANIFEST_FILES)) {
    validateAgainstSchema(documents[key], schemas[key], key, schemas[key], errors);
    const expectedSchemaRef = `./schemas/${SCHEMA_FILES[key]}`;
    if (documents[key]?.$schema !== expectedSchemaRef) {
      errors.push(`${key}.$schema: 应引用 ${JSON.stringify(expectedSchemaRef)}`);
    }
  }

  // 结构已坏时先返回精确的 Schema 路径，避免跨文件检查被错误类型打断。
  if (errors.length > 0) return errors;

  const { game, balance, levels, copy, theme, assets, audio, events } = documents;
  if (!game || !balance || !levels || !copy || !theme || !assets || !audio || !events) return errors;

  for (const [key, file] of Object.entries(MANIFEST_FILES)) {
    if (key === 'game') continue;
    if (game.manifestRefs?.[key] !== file) errors.push(`game.manifestRefs.${key}: 应为 ${JSON.stringify(file)}`);
  }
  if (game.contentVersion !== balance.version) errors.push('balance.version: 必须与 game.contentVersion 一致');
  if (game.contentVersion !== levels.version) errors.push('levels.version: 必须与 game.contentVersion 一致');
  if (game.contentVersion !== copy.version) errors.push('copy.version: 必须与 game.contentVersion 一致');
  for (const key of ['theme', 'assets', 'audio']) {
    if (documents[key].version !== game.presentationVersion) errors.push(`${key}.version: 必须与 game.presentationVersion 一致`);
  }
  if (copy.locale !== game.locale) errors.push('copy.locale: 必须与 game.locale 一致');
  if (copy.strings?.['game.title'] !== game.title) errors.push('copy.strings.game.title: 必须与 game.title 一致');
  if (game.starterUnits?.length > game.benchSize) errors.push('game.starterUnits: 数量不能超过 benchSize');

  game.starterUnits?.forEach((id, index) => addReferenceError(errors, `game.starterUnits[${index}]`, id, balance.troops, '兵种'));
  balance.gachaWeights?.forEach((entry, index) => {
    const path = `balance.gachaWeights[${index}]`;
    if (entry.kind === 'troop') {
      if (!entry.type) errors.push(`${path}.type: troop 权重必须声明兵种`);
      else addReferenceError(errors, `${path}.type`, entry.type, balance.troops, '兵种');
    }
    if (entry.kind === 'shovel') {
      if (!entry.itemId) errors.push(`${path}.itemId: shovel 权重必须声明道具`);
      else addReferenceError(errors, `${path}.itemId`, entry.itemId, balance.items, '道具');
    }
  });
  Object.entries(balance.troops ?? {}).forEach(([id, troop]) => {
    const path = `balance.troops.${id}`;
    if (troop.behaviorId === 'unit.producer') {
      if (troop.produce === undefined || troop.interval === undefined) errors.push(`${path}: 生产单位必须定义 produce/interval`);
    } else if (troop.dmg === undefined || troop.cd === undefined || troop.range === undefined) {
      errors.push(`${path}: 战斗单位必须定义 dmg/cd/range`);
    }
    if (troop.projectile && troop.projectileSpeed === undefined) errors.push(`${path}.projectileSpeed: 弹道单位必须定义速度`);
    addReferenceError(errors, `${path}.renderId`, troop.renderId, theme.renderers?.troops ?? {}, '兵种渲染器');
  });
  Object.entries(balance.heroes ?? {}).forEach(([id, hero]) => {
    addReferenceError(errors, `balance.heroes.${id}.skillId`, hero.skillId, balance.skills, '技能');
    addReferenceError(errors, `balance.heroes.${id}.renderId`, hero.renderId, theme.heroVisuals ?? {}, '英雄表现');
  });
  Object.entries(balance.skills ?? {}).forEach(([id, skill]) => {
    skill.effectIds?.forEach((effectId, index) => addReferenceError(
      errors, `balance.skills.${id}.effectIds[${index}]`, effectId, theme.renderers?.effects ?? {}, '效果渲染器',
    ));
  });
  Object.entries(balance.items ?? {}).forEach(([id, item]) => {
    addReferenceError(errors, `balance.items.${id}.renderId`, item.renderId, theme.renderers?.items ?? {}, '道具渲染器');
    if (item.outputItemId) addReferenceError(errors, `balance.items.${id}.outputItemId`, item.outputItemId, balance.items, '道具');
  });

  ensureUnique(errors, levels.stages?.map((stage) => stage.id) ?? [], 'levels.stages', '关卡 ID');
  ensureUnique(errors, levels.stages?.map((stage) => stage.name) ?? [], 'levels.stages', '关卡名');
  ensureUnique(errors, levels.stages?.map((stage) => stage.star) ?? [], 'levels.stages', '星级');
  levels.stages?.forEach((stage, index) => {
    const path = `levels.stages[${index}]`;
    addReferenceError(errors, `${path}.mapId`, stage.mapId, levels.maps, '地图');
    addReferenceError(errors, `${path}.featuredHero`, stage.featuredHero, balance.heroes, '英雄');
    addReferenceError(errors, `${path}.finalEnemy`, stage.finalEnemy, balance.enemy.types, '敌人');
    if (stage.star !== index + 1) errors.push(`${path}.star: 应按顺序为 ${index + 1}`);
    const copyKey = `stage.${stage.id}.name`;
    if (copy.strings?.[copyKey] !== stage.name) errors.push(`copy.strings.${copyKey}: 必须与关卡名一致`);
  });
  if ((copy.stageNumerals?.length ?? 0) < (levels.stages?.length ?? 0)) errors.push('copy.stageNumerals: 数量不能少于关卡数');
  Object.entries(levels.maps ?? {}).forEach(([id, map]) => validateMap(errors, id, map, game.board));

  const assetById = Object.fromEntries((assets.assets ?? []).map((asset) => [asset.id, asset]));
  ensureUnique(errors, assets.assets?.map((asset) => asset.id) ?? [], 'assets.assets', '素材 ID');
  theme.assetRefs?.forEach((id, index) => addReferenceError(errors, `theme.assetRefs[${index}]`, id, assetById, '素材'));
  Object.entries(theme.assetBindings ?? {}).forEach(([role, id]) => addReferenceError(
    errors, `theme.assetBindings.${role}`, id, assetById, '素材',
  ));
  addReferenceError(errors, 'theme.toolAtlas.assetId', theme.toolAtlas?.assetId, assetById, '素材');
  const slotCount = (theme.toolAtlas?.columns ?? 0) * (theme.toolAtlas?.rows ?? 0);
  Object.entries(theme.toolAtlas?.slots ?? {}).forEach(([id, slot]) => {
    if (slot >= slotCount) errors.push(`theme.toolAtlas.slots.${id}: 槽位 ${slot} 超出 ${slotCount} 格图集`);
  });
  Object.entries(theme.feedback ?? {}).forEach(([id, feedback]) => addReferenceError(
    errors, `theme.feedback.${id}.effectId`, feedback.effectId, theme.renderers?.effects ?? {}, '效果渲染器',
  ));
  const themeOptions = theme.themeCatalog?.options ?? {};
  addReferenceError(
    errors,
    'theme.themeCatalog.defaultThemeId',
    theme.themeCatalog?.defaultThemeId,
    themeOptions,
    '默认主题',
  );
  Object.entries(themeOptions).forEach(([id, option]) => {
    addReferenceError(errors, `theme.themeCatalog.options.${id}.labelCopyId`, option.labelCopyId, copy.strings, '文案');
  });

  const eventById = Object.fromEntries((events.events ?? []).map((event) => [event.id, event]));
  ensureUnique(errors, events.events?.map((event) => event.id) ?? [], 'events.events', '事件 ID');
  REQUIRED_EVENT_IDS.forEach((id) => addReferenceError(errors, 'events.events', id, eventById, '必需事件'));
  REQUIRED_EVENT_FIELDS.forEach((field) => {
    if (!events.requiredCommonFields?.includes(field)) errors.push(`events.requiredCommonFields: 缺少 ${field}`);
  });
  if (events.gameVersion !== game.gameVersion) errors.push('events.gameVersion: 必须与 game.gameVersion 一致');
  if (events.rulesetVersion !== game.ruleset.version) errors.push('events.rulesetVersion: 必须与 game.ruleset.version 一致');
  if (events.contentVersion !== game.contentVersion) errors.push('events.contentVersion: 必须与 game.contentVersion 一致');
  Object.entries(audio.eventMap ?? {}).forEach(([eventId, cueId]) => {
    addReferenceError(errors, `audio.eventMap.${eventId}`, eventId, eventById, '事件');
    addReferenceError(errors, `audio.eventMap.${eventId}`, cueId, audio.cues, '音频 Cue');
  });

  return errors;
}

function jpegDimensions(bytes) {
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  const startOfFrame = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);
  let offset = 2;
  while (offset + 8 < bytes.length) {
    while (bytes[offset] === 0xff) offset++;
    const marker = bytes[offset++];
    if (marker === 0xd8 || marker === 0x01) continue;
    if (marker === 0xd9 || marker === 0xda) break;
    const length = bytes.readUInt16BE(offset);
    if (startOfFrame.has(marker)) return { height: bytes.readUInt16BE(offset + 3), width: bytes.readUInt16BE(offset + 5) };
    if (length < 2) return null;
    offset += length;
  }
  return null;
}

async function validateAssetFiles(packDir, assets) {
  const errors = [];
  const repositoryRoot = resolve(packDir, '../..');
  for (const [index, asset] of (assets.assets ?? []).entries()) {
    const path = `assets.assets[${index}]`;
    const file = resolve(packDir, asset.path);
    const fromRoot = relative(repositoryRoot, file);
    if (fromRoot.startsWith('..') || fromRoot === '') {
      errors.push(`${path}.path: 必须指向仓库内文件`);
      continue;
    }
    try {
      await access(file);
    } catch {
      errors.push(`${path}.path: 文件不存在 ${asset.path}`);
      continue;
    }
    const extension = extname(file).toLowerCase();
    const expectedExtensions = asset.format === 'jpeg' ? ['.jpg', '.jpeg'] : [`.${asset.format}`];
    if (!expectedExtensions.includes(extension)) errors.push(`${path}.format: ${asset.format} 与扩展名 ${extension} 不符`);
    if (asset.type !== 'image' || !['png', 'jpeg'].includes(asset.format)) continue;
    const bytes = await readFile(file);
    const dimensions = asset.format === 'png'
      ? bytes.subarray(1, 4).toString() === 'PNG' && { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) }
      : jpegDimensions(bytes);
    if (!dimensions) errors.push(`${path}.path: 无法解码 ${asset.format} 图片头`);
    else if (dimensions.width !== asset.width || dimensions.height !== asset.height) {
      errors.push(`${path}: 声明尺寸 ${asset.width}x${asset.height} 与文件 ${dimensions.width}x${dimensions.height} 不一致`);
    }
  }
  return errors;
}

export async function validateGamePackDirectory(packDir = DEFAULT_PACK_DIR) {
  const loaded = await loadGamePackDirectory(packDir);
  const errors = validateGamePackDocuments(loaded.documents, loaded.schemas);
  if (errors.length === 0) errors.push(...await validateAssetFiles(loaded.packDir, loaded.documents.assets));
  return { ...loaded, errors };
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const packDir = process.argv[2] ? resolve(process.cwd(), process.argv[2]) : DEFAULT_PACK_DIR;
  try {
    const { documents, errors } = await validateGamePackDirectory(packDir);
    if (errors.length > 0) {
      console.error(`✗ Game Pack 校验失败（${errors.length} 项）`);
      errors.forEach((error) => console.error(`  - ${error}`));
      process.exitCode = 1;
    } else {
      const assetCount = documents.assets.assets.length;
      const eventCount = documents.events.events.length;
      console.log(`✓ Game Pack ${documents.game.id} 校验通过（8 manifests, 8 schemas, ${assetCount} assets, ${eventCount} events）`);
    }
  } catch (error) {
    console.error(`✗ Game Pack 校验无法执行: ${error.message}`);
    process.exitCode = 1;
  }
}
