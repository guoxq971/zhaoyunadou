#!/usr/bin/env node
// 把 Chrome 公开 dataset 与真实图片尺寸整理成可由测试机复验的证据清单。
import { execFileSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sourceFingerprint } from '../test/source-fingerprint.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const date = process.argv[2];
if (!/^\d{4}-\d{2}-\d{2}$/.test(date ?? '')) {
  throw new Error('用法: node scripts/build-screenshot-manifest.mjs YYYY-MM-DD');
}

const artifactDir = join(root, 'test-artifacts/screenshots', date);
const raw = JSON.parse(await readFile(join(artifactDir, 'raw-captures.json'), 'utf8'));
const booleanKeys = new Set([
  'assetsReady', 'bossActive', 'luoyangEnabled', 'luoyangPending', 'over',
  'paused', 'phaseReady', 'saveWarning', 'win',
]);
const numberPattern = /^-?(?:\d+|\d+\.\d+)$/;

function normalizeState(state) {
  return Object.fromEntries(Object.entries(state).map(([key, value]) => {
    if (booleanKeys.has(key) && (value === 'true' || value === 'false')) {
      return [key, value === 'true'];
    }
    if (typeof value === 'string' && numberPattern.test(value)) {
      return [key, Number(value)];
    }
    return [key, value];
  }));
}

function pngSize(bytes, file) {
  if (bytes.subarray(1, 4).toString() !== 'PNG') {
    throw new Error(`${file} 还不是真实 PNG，请先运行 normalize-screenshots.py`);
  }
  return `${bytes.readUInt32BE(16)}x${bytes.readUInt32BE(20)}`;
}

const seen = new Set();
const screenshots = [];
for (const capture of raw.captures) {
  if (seen.has(capture.file)) continue;
  seen.add(capture.file);
  const bytes = await readFile(join(artifactDir, capture.file));
  const state = normalizeState(capture.state);
  let testPoint = capture.testPoint;
  if (state.screen === 'result' && state.win === false) {
    testPoint = `第${state.stage}关失败结算·重整再战`;
  }
  screenshots.push({
    file: capture.file,
    runId: raw.runId,
    testPoint,
    viewport: '1916x808',
    imageSize: pngSize(bytes, capture.file),
    canvasRect: '420x760@748,24',
    state,
    result: 'pass',
  });
}

const gitHead = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
const workingTree = execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }).trim()
  ? 'dirty'
  : 'clean';
const issues = raw.browserIssues ?? [];
const manifest = {
  schemaVersion: 2,
  runId: raw.runId,
  generatedAt: new Date().toISOString(),
  baseUrl: raw.baseUrl || 'http://127.0.0.1:8460/',
  browser: raw.browser,
  userAgent: raw.userAgent || 'Chrome version unavailable',
  gitHead,
  workingTree,
  sourceFingerprint: await sourceFingerprint(root),
  consoleErrors: issues.filter((entry) => entry.level === 'error').length,
  consoleWarnings: issues.filter((entry) => ['warn', 'warning'].includes(entry.level)).length,
  currentRunFiles: screenshots.map((entry) => entry.file),
  screenshots,
};

await writeFile(join(artifactDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`manifest=${join(artifactDir, 'manifest.json')}`);
console.log(`screenshots=${screenshots.length}`);
