import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { DEFAULT_GAME_PACK } from '../src/game-pack.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const probePath = path.join(root, 'probes/wechat-minigame/game.js');
const source = await readFile(probePath, 'utf8');

for (const api of [
  'wx.createCanvas',
  'wx.createOffscreenCanvas',
  'wx.createImage',
  'wx.onTouchStart',
  'wx.createInnerAudioContext',
  'wx.setStorageSync',
  'wx.getStorageSync',
  'wx.onHide',
  'wx.onShow',
  'wx.getWindowInfo',
]) {
  assert.ok(source.includes(api), `探针缺少 ${api}`);
}

assert.deepEqual(DEFAULT_GAME_PACK.manifests.game.targetPlatforms, ['web'], '未完成正式适配前不得宣称微信目标');
const mainSource = await readFile(path.join(root, 'src/main.js'), 'utf8');
assert.doesNotMatch(mainSource, /wechat-minigame|typeof wx|\bwx\./, '技术探针不得进入正式应用入口');

const cleanupCalls = [];
let frameId = 0;
const context = {
  Date,
  console: { info() {} },
  requestAnimationFrame() { return ++frameId; },
  cancelAnimationFrame(id) { cleanupCalls.push(`frame:${id}`); },
  wx: {
    createCanvas() {
      return {
        width: 0,
        height: 0,
        getContext() {
          return { fillRect() {}, fillText() {}, drawImage() {} };
        },
      };
    },
    createOffscreenCanvas() { return this.createCanvas(); },
    createImage() { return {}; },
    getWindowInfo() { return { windowWidth: 320, windowHeight: 568, pixelRatio: 2 }; },
    setStorageSync() {},
    getStorageSync() { return 'round-trip'; },
    removeStorageSync() {},
    createInnerAudioContext() {
      return {
        onPlay() {}, onError() {}, play() {},
        destroy() { cleanupCalls.push('audio'); },
      };
    },
    onTouchStart() {}, onHide() {}, onShow() {},
    offTouchStart() { cleanupCalls.push('touch'); throw new Error('simulated offTouchStart failure'); },
    offHide() { cleanupCalls.push('hide'); },
    offShow() { cleanupCalls.push('show'); },
  },
};
context.globalThis = context;
vm.runInNewContext(source, context, { filename: probePath });
assert.equal(context.__destroyWechatHostProbe(), false, '单项清理失败必须形成失败结果');
assert.deepEqual(cleanupCalls, [
  'frame:2', // 探针主体先验证了 cancelAnimationFrame。
  'touch', 'hide', 'show', 'frame:1', 'frame:3', 'frame:2', 'audio',
], '一个微信 API 抛错后仍须继续释放全部资源');

console.log('✓ 微信最薄探针 API 完整且与正式代码隔离');
