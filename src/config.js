// 全部数值配置 —— 平衡调整只改这里
export const CONFIG = {
  canvas: { w: 420, h: 840 },
  board: { cols: 9, rows: 10, cell: 44, ox: 12, oy: 95 },
  benchSize: 5,
  startMantou: 40,
  startLives: 6,
  startShovels: 1,

  // 第 i 次征兵费用(i 从 0 起):16,20,26,34,44…
  recruitCost: (i) => 16 + i * i + 3 * i,

  gachaWeights: [
    { kind: 'troop', type: 'dao',   w: 21 },
    { kind: 'troop', type: 'qiang', w: 21 },
    { kind: 'troop', type: 'gong',  w: 21 },
    { kind: 'troop', type: 'qi',    w: 21 },
    { kind: 'frag',  w: 10 },
    { kind: 'troop', type: 'nong',  w: 4 },
    { kind: 'shovel', w: 2 },
  ],

  troops: {
    dao:   { char: '刀', dmg: 6,  cd: 0.55, range: 1.35 },
    qiang: { char: '枪', dmg: 10, cd: 0.90, range: 2.30 },
    gong:  { char: '弓', dmg: 7,  cd: 1.05, range: 3.80, projectile: true },
    qi:    { char: '骑', dmg: 16, cd: 1.50, range: 1.90 },
    nong:  { char: '农', produce: 2, interval: 3 },
  },
  levelMult: 2.2,
  maxLevel: 5,

  heroes: {
    liubei:     { name: '刘备', chars: ['刘', '备'], dmg: 26, cd: 0.80, range: 3.2, ultCd: 16, ult: 'aura' },
    guanyu:     { name: '关羽', chars: ['关', '羽'], dmg: 34, cd: 0.90, range: 2.6, ultCd: 14, ult: 'slash' },
    zhangfei:   { name: '张飞', chars: ['张', '飞'], dmg: 30, cd: 0.85, range: 2.2, ultCd: 15, ult: 'shout' },
    zhaoyun:    { name: '赵云', chars: ['赵', '云'], dmg: 36, cd: 0.75, range: 3.0, ultCd: 15, ult: 'dragon' },
    huangzhong: { name: '黄忠', chars: ['黄', '忠'], dmg: 30, cd: 1.00, range: 4.5, ultCd: 16, ult: 'rain' },
  },
  ults: {
    dragon: { dmg: 90 },            // 火龙贯路:沿路径扫过,路上每个敌人受伤
    rain:   { dmg: 55 },            // 箭雨:全屏
    shout:  { dmg: 20, stun: 2.5 }, // 震喝:全场眩晕
    slash:  { dmg: 130, range: 3 }, // 横斩:范围重伤
    aura:   { mult: 1.5, dur: 8 },  // 仁德:全体我方增伤
  },

  enemy: {
    baseHp: 24, hpGrowth: 1.22, baseSpeed: 1.05, // 速度单位:格/秒
    types: {
      normal: { char: '贼', hpMul: 1,   spdMul: 1,   size: 1 },
      fast:   { char: '飞', hpMul: 0.6, spdMul: 1.8, size: 0.9, tint: '#7a4' },
      tank:   { char: '巨', hpMul: 3.2, spdMul: 0.55, size: 1.25, tint: '#666' },
      elite:  { char: '悍', hpMul: 6,   spdMul: 0.8, size: 1.3, tint: '#a33' },
      boss:   { char: '魁', hpMul: 22,  spdMul: 0.45, size: 1.6, tint: '#711' },
    },
  },
  waves: {
    count: 20,
    size: (w) => 6 + w,
    spawnInterval: 0.85,
    breakTime: 3.5,
    killReward: (w) => 2 + Math.floor(w / 5),
    waveBonus: (w) => 8 + w * 2,
  },
};
