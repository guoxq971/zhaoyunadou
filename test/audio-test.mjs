import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createWebAudioAdapter } from '../src/platforms/web/web-audio.js';
import { DEFAULT_GAME_PACK } from '../src/game-pack.js';
import { createSafeAudioAdapter } from '../src/audio.js';

const manifest = DEFAULT_GAME_PACK.manifests.audio;
assert.equal(await createWebAudioAdapter({}, manifest).init(), false, '无 WebAudio 时应静默降级');

{
  const diagnosticFailure = () => { throw new Error('diagnostic failed'); };
  const syncSafe = createSafeAudioAdapter({
    play() { throw new Error('adapter failed'); },
  }, diagnosticFailure);
  assert.doesNotThrow(() => syncSafe.play('merge'),
    '同步 Adapter 与诊断回调同时抛错也不得中断玩法');
  assert.equal(syncSafe.play('merge'), false);

  const asyncSafe = createSafeAudioAdapter({
    play() { return Promise.reject(new Error('async adapter failed')); },
  }, diagnosticFailure);
  assert.equal(await asyncSafe.play('merge'), false,
    '异步 Adapter 失败必须解析为降级值，诊断回调不得制造 unhandled rejection');
}

{
  const source = await readFile(new URL('../src/platforms/web/web-audio.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /presentation-pack|skin-presentation/, 'Platform Audio 不得深导入皮肤/表现系统');
}

{
  const cue = Object.freeze({ voices: [] });
  const cueSource = Object.freeze({
    has(id) { return id === 'injected'; },
    get(id) {
      if (id !== 'injected') throw new Error(`unknown cue ${id}`);
      return cue;
    },
  });
  const engine = createWebAudioAdapter({}, cueSource);
  assert.equal(engine.play('injected'), false, '注入的只读 CueSource 必须可被消费且无 WebAudio 时降级');
  assert.equal(engine.play('missing'), false, '未知 Cue 必须稳定拒绝');
}

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

{
  const calls = [];
  class FakeParam {
    constructor(value = 0) { this.value = value; }
    setValueAtTime(value, time) { calls.push(['set', value, time]); this.value = value; }
    exponentialRampToValueAtTime(value, time) { calls.push(['ramp', value, time]); }
  }
  class FakeNode {
    constructor(kind) {
      this.kind = kind;
      this.gain = new FakeParam(1);
      this.frequency = new FakeParam();
    }
    connect(target) { calls.push(['connect', this.kind, target?.kind ?? 'destination']); return target; }
  }
  class SuccessfulAudioContext {
    constructor() {
      this.state = 'running';
      this.currentTime = 2;
      this.destination = { kind: 'destination' };
      this.oscillators = [];
      this.gains = [];
      SuccessfulAudioContext.instance = this;
    }
    createGain() {
      const gain = new FakeNode('gain');
      this.gains.push(gain);
      return gain;
    }
    createOscillator() {
      const oscillator = new FakeNode('oscillator');
      oscillator.start = () => calls.push(['start']);
      oscillator.stop = (time) => calls.push(['stop', time]);
      this.oscillators.push(oscillator);
      return oscillator;
    }
    async suspend() { calls.push(['suspend']); this.state = 'suspended'; }
    async resume() { calls.push(['resume']); this.state = 'running'; }
    async close() { calls.push(['close']); this.state = 'closed'; }
  }

  const engine = createWebAudioAdapter({ AudioContext: SuccessfulAudioContext }, manifest);
  assert.equal(await engine.init(), true);
  assert.equal(engine.play('merge'), true, '稳定 Cue ID 必须真实送入振荡器');
  const oscillator = SuccessfulAudioContext.instance.oscillators[0];
  assert.equal(oscillator.type, 'triangle');
  assert.ok(calls.some((entry) => entry[0] === 'set' && entry[1] === 440 && entry[2] === 2));
  assert.ok(calls.some((entry) => entry[0] === 'ramp' && entry[1] === 880 && entry[2] === 2.1));
  assert.ok(calls.some((entry) => entry[0] === 'stop' && entry[1] === 2.1));
  engine.setVolume(2);
  assert.equal(SuccessfulAudioContext.instance.gains[0].gain.value, 1, '主音量上限必须钳制为 1');
  assert.equal(SuccessfulAudioContext.instance.state, 'running');
  await engine.pause();
  await engine.resume();
  engine.setVolume(-1);
  assert.equal(SuccessfulAudioContext.instance.gains[0].gain.value, 0, '主音量下限必须钳制为 0');
  await engine.destroy();
  assert.equal(engine.play('merge'), false, '销毁后不得残留可播放实例');
  assert.deepEqual(calls.filter(([kind]) => ['suspend', 'resume', 'close'].includes(kind)), [
    ['suspend'], ['resume'], ['close'],
  ]);
}

console.log('✓ 音频不可用、恢复拒绝、真实 voice 链路与销毁');
