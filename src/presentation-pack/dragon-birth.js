const clamp01 = (value) => Math.max(0, Math.min(1, value));

const mix = (from, to, progress) => from + (to - from) * progress;

// 出生演出只改变表现坐标：逻辑火龙仍按原 p/speed 在 Skill/Status 中推进。
export function dragonBirthPose(effect, routePose, tokens = {}) {
  const birthSeconds = Math.max(0.001, tokens.birthSeconds ?? 0.46);
  const startScale = clamp01(tokens.startScale ?? 0.08);
  const progress = clamp01((effect.t ?? 0) / birthSeconds);
  if (!Number.isFinite(effect.originX) || !Number.isFinite(effect.originY) || progress >= 1) {
    return {
      ...routePose,
      birthProgress: 1,
      bodyProgress: 1,
      dragonAlpha: 1,
      originAlpha: 0,
      scale: 1,
      controlX: routePose.x,
      controlY: routePose.y,
    };
  }

  const eased = 1 - (1 - progress) ** 3;
  const laneDirection = (effect.lane ?? 0) % 2 === 0 ? -1 : 1;
  const arcLift = (tokens.arcLift ?? 32) * laneDirection;
  const controlX = mix(effect.originX, routePose.x, 0.38);
  const controlY = mix(effect.originY, routePose.y, 0.24) + arcLift;
  const inverse = 1 - eased;
  const x = inverse * inverse * effect.originX
    + 2 * inverse * eased * controlX
    + eased * eased * routePose.x;
  const y = inverse * inverse * effect.originY
    + 2 * inverse * eased * controlY
    + eased * eased * routePose.y;
  const tangentX = 2 * inverse * (controlX - effect.originX)
    + 2 * eased * (routePose.x - controlX);
  const tangentY = 2 * inverse * (controlY - effect.originY)
    + 2 * eased * (routePose.y - controlY);

  return {
    x,
    y,
    angle: Math.atan2(tangentY, tangentX),
    birthProgress: progress,
    bodyProgress: clamp01((progress - 0.05) / 0.85),
    dragonAlpha: clamp01(progress / 0.16),
    originAlpha: clamp01(1 - progress * 1.35),
    scale: mix(startScale, 1, eased),
    controlX,
    controlY,
  };
}
