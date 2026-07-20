// 隔离技术探针：不 import 正式游戏源码，不作为发布目标。
const results = [];
let mainCanvas = null;
let ctx = null;
let mainCanvasError = null;
let windowInfoError = null;
let info = { windowWidth: 320, windowHeight: 568, pixelRatio: 1 };
try {
  mainCanvas = wx.createCanvas();
  ctx = mainCanvas?.getContext?.('2d') ?? null;
} catch (error) {
  mainCanvasError = error;
}
try {
  info = { ...info, ...wx.getWindowInfo() };
} catch (error) {
  windowInfoError = error;
}
const width = Number(info.windowWidth) || 320;
const height = Number(info.windowHeight) || 568;

function record(step, result, detail = {}) {
  const entry = { step, result, at: Date.now(), ...detail };
  results.push(entry);
  console.info('[wechat-host-probe]', JSON.stringify(entry));
  draw();
}

function draw() {
  if (!ctx) return;
  ctx.fillStyle = '#eadfc5';
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = '#2f2922';
  ctx.font = '16px sans-serif';
  ctx.fillText('赵云与阿斗 · Host 能力探针', 18, 30);
  ctx.font = '12px sans-serif';
  results.slice(-14).forEach((entry, index) => {
    ctx.fillStyle = entry.result === 'pass' ? '#35643b'
      : entry.result === 'fail' ? '#9b3028' : '#7b6424';
    ctx.fillText(`${entry.result.toUpperCase()}  ${entry.step}`, 18, 58 + index * 20);
  });
  ctx.fillStyle = '#5a4937';
  ctx.fillText('触摸屏幕后才会尝试音频；需人工确认是否可听。', 18, height - 24);
}

record('main-canvas', ctx ? 'pass' : 'fail', {
  width, height, pixelRatio: info.pixelRatio,
  message: mainCanvasError ? String(mainCanvasError?.message ?? mainCanvasError) : undefined,
});
record('window-info', windowInfoError ? 'fail' : 'pass', {
  width, height, pixelRatio: info.pixelRatio, safeArea: info.safeArea ?? null,
  message: windowInfoError ? String(windowInfoError?.message ?? windowInfoError) : undefined,
});

// 当前小游戏官方文档以“第二次 createCanvas”创建离屏画布。
const hasDedicatedOffscreen = typeof wx.createOffscreenCanvas === 'function';
let offscreen = null;
let offscreenContext = null;
let offscreenError = null;
try {
  offscreen = hasDedicatedOffscreen
    ? wx.createOffscreenCanvas({ type: '2d', width: 32, height: 32 })
    : wx.createCanvas();
  offscreen.width = 32;
  offscreen.height = 32;
  offscreenContext = offscreen.getContext?.('2d') ?? null;
  if (offscreenContext) {
    offscreenContext.fillStyle = '#9d3328';
    offscreenContext.fillRect(0, 0, 32, 32);
    ctx?.drawImage?.(offscreen, width - 48, 14, 32, 32);
  }
} catch (error) {
  offscreenError = error;
}
record('offscreen-canvas', offscreenContext ? 'pass' : 'fail', {
  implementation: hasDedicatedOffscreen ? 'dedicated-api' : 'second-createCanvas',
  message: offscreenError ? String(offscreenError?.message ?? offscreenError) : undefined,
});

let image = null;
try {
  image = wx.createImage();
  image.onload = () => record('image-load', 'pass', { width: image.width, height: image.height });
  image.onerror = (error) => record('image-load', 'fail', { message: String(error?.errMsg ?? error) });
  image.src = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
} catch (error) {
  record('image-load', 'fail', { message: String(error?.message ?? error) });
}

const storageKey = '__zyad_wechat_host_probe__';
try {
  wx.setStorageSync(storageKey, 'round-trip');
  const value = wx.getStorageSync(storageKey);
  wx.removeStorageSync(storageKey);
  record('storage-round-trip', value === 'round-trip' ? 'pass' : 'fail', { value });
} catch (error) {
  record('storage-round-trip', 'fail', { message: String(error?.message ?? error) });
}

let audio = null;
try {
  audio = wx.createInnerAudioContext();
  audio.src = 'data:audio/wav;base64,UklGRhQBAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YfAAAAAAAJ0GcwzPEC8TShMdEeoMMAedAPf5CPSD7/HsoOyZ7qLyP/jH/nIFegsnEOoScROsEc8NUAjWASX7BvUz8D/tguwU7sTxI/eO/UIEdwpuD5MShRMoEqYOaAkOA1j8D/b08KDteOyg7fTwD/ZY/A4DaAmmDigShROTEm4PdwpCBI79I/fE8RTuguw/7TPwBvUl+9YBUAjPDawRcRPqEicQegtyBcf+P/ii8pnuoOzx7IPvCPT3+Z0AMAfqDB0RShMvE88QcwydBgAAY/mN8zHv0ey27OPuFvPQ+GP/CQb4C30QDxNgE2cRXg3BBzkBjvo=';
  audio.onPlay(() => record('audio-play-callback', 'pass'));
  audio.onError((error) => record('audio-play-callback', 'fail', { message: error.errMsg, code: error.errCode }));
  record('audio-create', 'pass');
} catch (error) {
  record('audio-create', 'fail', { message: String(error?.message ?? error) });
}

let audioAttempted = false;
function onTouchStart(event) {
  const touch = event.touches?.[0] ?? event.changedTouches?.[0];
  record('touch-start', touch ? 'pass' : 'fail', {
    identifier: touch?.identifier,
    x: touch?.clientX,
    y: touch?.clientY,
  });
  if (!audioAttempted) {
    audioAttempted = true;
    try {
      if (!audio) throw new Error('InnerAudioContext unavailable');
      audio.play();
      record('audio-play-call', 'pass');
    }
    catch (error) { record('audio-play-call', 'fail', { message: String(error?.message ?? error) }); }
  }
}
try { wx.onTouchStart(onTouchStart); }
catch (error) { record('touch-subscribe', 'fail', { message: String(error?.message ?? error) }); }

let frameId = null;
let cancelCheckFrameId = null;
let cancelledFrameId = null;
let cancelledFrameRan = false;
try {
  frameId = requestAnimationFrame((timestamp) => {
    const performanceUs = wx.getPerformance?.().now?.();
    record('render-frame', Number.isFinite(timestamp) ? 'pass' : 'fail', {
      timestamp,
      monotonicMs: Number.isFinite(performanceUs) ? performanceUs / 1000 : null,
    });
  });
  cancelledFrameId = requestAnimationFrame(() => { cancelledFrameRan = true; });
  cancelAnimationFrame(cancelledFrameId);
  cancelCheckFrameId = requestAnimationFrame(() => {
    record('cancel-frame', cancelledFrameRan ? 'fail' : 'pass');
  });
} catch (error) {
  record('render-frame', 'fail', { message: String(error?.message ?? error) });
  record('cancel-frame', 'fail', { message: String(error?.message ?? error) });
}

function onHide() { record('background', 'pass'); }
function onShow() { record('resume', 'pass'); }
try {
  wx.onHide(onHide);
  wx.onShow(onShow);
  record('lifecycle-subscribe', 'pass');
} catch (error) {
  record('lifecycle-subscribe', 'fail', { message: String(error?.message ?? error) });
}

record('runtime-verification', 'pending', {
  reason: 'requires-wechat-devtools-and-ios-android-client-evidence',
});

// 便于开发者工具控制台人工收尾；平台被系统销毁时不保证有回调。
globalThis.__destroyWechatHostProbe = () => {
  const cleanups = [
    ['cleanup-touch', () => wx.offTouchStart(onTouchStart)],
    ['cleanup-hide', () => wx.offHide(onHide)],
    ['cleanup-show', () => wx.offShow(onShow)],
    ['cleanup-frame', () => { if (frameId !== null) cancelAnimationFrame(frameId); }],
    ['cleanup-cancel-check', () => { if (cancelCheckFrameId !== null) cancelAnimationFrame(cancelCheckFrameId); }],
    ['cleanup-cancelled-frame', () => { if (cancelledFrameId !== null) cancelAnimationFrame(cancelledFrameId); }],
    ['cleanup-audio', () => audio?.destroy?.()],
  ];
  let clean = true;
  // 任一平台 API 缺失或抛错都只影响自身证据，不能阻断其余资源释放。
  for (const [step, cleanup] of cleanups) {
    try { cleanup(); }
    catch (error) {
      clean = false;
      record(step, 'fail', { message: String(error?.message ?? error) });
    }
  }
  return clean;
};
