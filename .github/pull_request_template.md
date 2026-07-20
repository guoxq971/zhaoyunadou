## 改动系统

- systemId：
- ownedPaths：
- 基线 SHA：
- 分支：`codex/sys-<system>-<feature>` / `codex/integration-game-systems-<cycle>`

## 负责 / 不负责

- 本 PR 负责：
- 明确不负责：
- 是否修改跨系统契约：否 / 是（必须独立提交并列受影响系统）

## 协议与状态

- GameCommand：
- publishes / consumes DomainEvent：
- ownedStateSlice：
- 是否新增兼容层及删除条件：

## 验证清单

- [ ] 只修改系统 ownedPaths；集成专属文件由集成负责人修改
- [ ] 无跨系统 deep import、平台泄漏和表现反向依赖
- [ ] `npm run test:boundaries`
- [ ] `npm run game-pack:validate`
- [ ] 系统 requiredTests
- [ ] `npm test`（集成 PR 必须）
- [ ] Game Pack 生成后 diff 已审查（内容/集成 PR）
- [ ] Chrome 五关与截图指纹已复验（最终集成 PR）
- [ ] 旧存档、确定性和 Host 无回归
- [ ] 未实现 Bot、联网、原生平台或商业化占位代码

## 证据

请粘贴实际命令、关键输出、截图路径和已知限制。
