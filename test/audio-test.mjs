import assert from 'node:assert/strict';
import { createWebAudioAdapter } from '../src/platforms/web/web-audio.js';
import { DEFAULT_GAME_PACK } from '../src/game-pack.js';

const manifest = DEFAULT_GAME_PACK.manifests.audio;
assert.equal(await createWebAudioAdapter({}, manifest).init(), false, '无 WebAudio 时应静默降级');

{
  let attempts = 0;
  class FakeAudioContext {
    constructor() { this.state = 'suspended'; }
    async resume() {
      attempts++;
      if (attempts === 1) throw new Error('autoplay denied');
      this.state = 'running';
    }
  }
  const engine = createWebAudioAdapter({ AudioContext: FakeAudioContext }, manifest);
  assert.equal(await engine.init(), false, '首次恢复失败必须被捕获');
  assert.equal(await engine.init(), true, '后续交互必须能够重试音频恢复');
  assert.equal(attempts, 2);
}

console.log('✓ 音频不可用、恢复拒绝与后续重试');
