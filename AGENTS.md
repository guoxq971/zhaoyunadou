# 《赵云与阿斗》多人维护规则

本文件补充上级 `AGENTS.md`，适用于本仓库。冲突时遵循离目标文件最近的规则。

## 基线与分支

- `main` 必须始终可发布；系统功能不得直接在 `main` 开发、提交或推送。
- 普通系统分支命名为 `codex/sys-<system>-<feature>`，例如 `codex/sys-board-atomic-swap`。
- 多系统周期集成分支命名为 `codex/integration-game-systems-<cycle>`。
- 每个需求使用独立 worktree；创建前必须核对起始 SHA、现有 worktree 和目标目录状态。
- 系统分支只修改 `architecture/system-ownership.json` 中本系统 `ownedPaths`；跨系统改动先拆为独立契约提交。

## 系统负责与不负责

- `foundation-runtime`：负责 GameCommand、DomainEvent、Registry、确定性随机/时间、序列、哈希和协议版本；不负责题材、数值、渲染或平台判断。
- `content-pack`：负责纯数据、Schema、稳定引用和编译校验；不修改运行时状态，不执行玩法或加载平台资源。
- `match-controller`：负责 MatchMode、Actor/side、授权和 Controller；不负责棋盘、战斗、网络传输或 UI 绘制。
- `board-route`：负责拓扑、占用、路径和原子移动/交换；不负责伤害、波次、经济、动画和热区。
- `piece-model`：负责弈子身份、类型、等级、位置及引用 ID；不负责抽取、资源、伤害和画法。
- `economy-formation`：负责战内资源、征兵、营栏、合成、拼字和编队；不负责永久进度、属性、战斗和渲染。
- `attribute`：负责 StatBlock、成长、Modifier 和最终值；不负责索敌、攻击流程、技能触发和装备持有。
- `combat`：负责索敌、攻击、Damage、投射物与死亡；不负责技能触发、装备槽和视觉特效。
- `skill-status`：负责技能、冷却、Buff/Debuff 和玩法效果；不负责装备槽、素材、动画和音效。
- `equipment-items`：负责真实道具及未来装备通过 Modifier/技能授予的扩展；不得复制属性或伤害算法。
- `stage-encounter`：负责关卡组合、波次、Boss 和局内胜负；不负责永久存档和皮肤。
- `progress-save`：负责 ProfileProgress、SaveEnvelope、迁移和旧存档兼容；不实现平台 Storage API，不运行关卡。
- `ui-interaction`：负责 ViewModel、语义布局、命中测试和输入意图映射；不判断最终玩法合法性，不直写玩法状态或决定皮肤颜色。
- `skin-presentation`：负责主题、Renderer、动画、音频与 PresentationCue；不负责热区、逻辑坐标、伤害和胜负。
- `platform-services`：负责 Host 能力和平台适配；不包含玩法、题材、Bot 或平台分支规则。
- `integration-quality` 是工程责任线：负责总装配、系统顺序、生成物、测试、CI 和发布指纹；不得新增玩法。

系统边界和开发窗口不一一对应。第一阶段可以由同一维护窗口负责 `piece-model + economy-formation`、`attribute + combat`、`skill-status + equipment-items`，但目录、状态切片和公共入口必须保持独立。

## 强制依赖规则

- 跨系统只能导入目标系统 `publicEntry`；禁止导入其他系统内部文件。
- `engine-core` 不得依赖 Game Pack、ruleset、presentation 或 platform。
- Game Pack 只提供纯数据；玩法系统不得导入 DOM、Canvas、Audio 或平台 SDK。
- Controller 只产生 GameCommand；规则 handler 才能决定合法性并修改所属切片。
- 一个系统不得直接写另一个系统的状态切片；使用命令、DomainEvent 或窄公共 API。
- DomainEvent 是确定性事实；TelemetryEvent 由服务层派生；PresentationCue 只描述反馈。三者不得混用。
- Telemetry、素材、声音或平台 Adapter 失败不得中断玩法。
- 新命令 handler 由各系统导出并由总分发器组合；重复命令类型必须在启动或测试时失败。

## 集成负责人专属文件

以下文件只有当前周期集成负责人可以修改：

- `src/main.js`
- `src/runtime.js`
- `src/state.js`
- `src/game-loop.js`
- `src/app-shell/`
- 总命令分发器组合
- 跨系统公共契约与版本
- `package.json` 测试编排
- `games/zhaoyun-adou/generated-manifests.js`

`balance.json` 和生成模块是兼容产物。普通系统分支只改对应人工来源；由集成负责人统一运行生成命令并检查 diff。

## 测试与提交

- 每项代码改动遵循 RED → GREEN → REFACTOR；先补失败测试。
- 系统分支至少运行清单中的 `requiredTests`、`npm run test:boundaries` 和 `npm run game-pack:validate`。
- 集成分支必须运行 `npm run game-pack:build` 后确认生成物同步，再运行 `npm test`。
- 修改 `index.html`、`package.json`、`assets/`、`games/`、`src/` 或 `test/` 后，必须重新采集真实 Chrome 截图并更新指纹，不能只改清单。
- 每阶段形成可审查的中文提交；跨系统契约变更必须单独提交并列出受影响系统。
- 只 `git add <明确文件>`；禁止 `git add .`、`git add -A`、force push 和 AI 署名。

## 合入顺序

1. 从统一基线 SHA 创建独立 worktree 和 `codex/sys-*` 分支。
2. 只修改所属路径并运行专项门禁。
3. 推送系统分支并提交到 `codex/integration-game-systems-*` 的 PR。
4. 集成负责人重建生成物、处理接线并运行全量/Chrome 复验。
5. 集成分支全绿后才申请合入 `main`；本仓库没有真实 CODEOWNERS 账号前不得虚构。
