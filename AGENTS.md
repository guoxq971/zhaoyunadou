# 《赵云与阿斗》多人维护规则

本文件补充上级 `AGENTS.md`，适用于本仓库。冲突时遵循离目标文件最近的规则。

任何人或自动化 Agent 在修改本项目之前都必须完整阅读本文件。它是项目介绍、目录导航和维护规则的唯一首要入口；详细设计由本文链接的架构文档承载，不再建立第二份相互竞争的规则文件。

## 项目介绍

- 《赵云与阿斗》是原生 HTML、Canvas2D 与 ES Module 实现的水墨汉字网格合成塔防游戏；当前首个 Game Pack 为 `games/zhaoyun-adou/`，规则集为 `merge-defense`。
- 玩家通过批量征兵、营栏与棋盘间拖放、原子交换、合成升级、英雄拼字、技能和道具完成固定路线的前五关战役。
- 本仓库同时是“稳定基座 + 可装载内容包”的模块化游戏工程：同一套确定性规则经 `GameCommand` 驱动，由应用壳装配 Game Pack、Host、控制器、存档、音频和事件。
- 当前唯一正式运行平台是 Web；当前唯一真实 MatchMode 是固定路线单机战役，唯一真实 Controller 是 `LocalPlayerController`。
- 当前没有机器人、异步/实时 PvP、账号、后端、商业化或正式微信小游戏 Adapter。不得把规划、探针或接口描述成已经实现的产品能力。

### 事实来源与阅读顺序

1. 本 `AGENTS.md`：维护流程、禁止事项和快速目录导航。
2. `architecture/system-ownership.json`：系统路径、状态切片、公开入口、允许依赖、命令/事件及必跑测试的机器事实源。
3. `docs/architecture/system-boundaries-v2.md`：每个系统负责/不负责、证据和迁移债务。
4. `docs/architecture/migration-plan-v2.md`：阶段 A–G 的迁移落点与兼容门面。
5. `docs/architecture/multi-maintainer-workflow.md`：worktree、系统分支、周期集成和合入流程。
6. `README.md`：安装、启动、操作、测试和平台使用说明。

摘要与机器清单不一致时，不得凭摘要继续修改：先以 `architecture/system-ownership.json` 和真实调用为证据，由集成负责人同步修正规则文档。

## 开工前检查

1. 完整读取仓库及上级目录中的 `AGENTS.md`。
2. 执行 `git status --short --branch`、`git rev-parse HEAD` 和 `git worktree list`，确认没有进入主 checkout 或未知脏 worktree。
3. 在 `architecture/system-ownership.json` 找到目标 `systemId`，核对 `ownedPaths`、`publicEntry`、`allowedDependencies`、`requiredTests` 和 `migrationStatus`。
4. 跨系统导入和调用只通过目标系统的 `publicEntry`；维护本系统时可读取其 `ownedPaths` 内部实现。随后读取对应专项测试，不得从旧兼容文件反推新的系统边界。
5. 涉及两个及以上系统、总装配、跨系统契约或生成物时，先拆出独立契约/集成任务，不在普通系统分支顺手接线。

## 真实目录结构

```text
.
├── AGENTS.md                         # 本规则：所有维护者的第一入口
├── README.md                         # 安装、运行、操作与测试说明
├── architecture/
│   └── system-ownership.json         # 16 条责任线的机器事实源
├── docs/architecture/                # 边界、迁移与多人协作的详细证据
├── games/zhaoyun-adou/               # 首个 Game Pack、8 个 Manifest 与 Schema
│   ├── sources/balance/              # 分系统人工维护的数值来源
│   └── generated-manifests.js        # 仅集成负责人重建的生成物
├── src/
│   ├── engine-core/                  # 平台/题材无关契约与确定性基座
│   ├── systems/                      # 13 个领域/应用系统的真实目录
│   │   ├── attribute/
│   │   ├── board/
│   │   ├── combat/
│   │   ├── content-pack/
│   │   ├── economy/
│   │   ├── equipment-items/
│   │   ├── match-mode/
│   │   ├── piece/
│   │   ├── progress-save/
│   │   ├── skill-status/
│   │   ├── skin-presentation/
│   │   ├── stage-encounter/
│   │   └── ui-interaction/
│   ├── controllers/                  # LocalPlayerController 等命令来源
│   ├── rulesets/merge-defense/       # 当前品类规则编译与跨系统组合
│   ├── presentation-pack/            # 稳定表现/音频 Cue 注册
│   ├── app-shell/                    # createGameApp 平台无关应用壳
│   ├── platform-contracts/           # 版本化 Host 契约
│   ├── platform-services/            # 平台端口与本地服务实现
│   └── platforms/web/                # 当前唯一正式 Web Host
├── assets/                            # 图片、字体等实际素材
├── probes/wechat-minigame/            # 隔离的微信能力探针，不是正式 Adapter
├── scripts/                           # 开发服务、Pack 构建/校验与截图工具
├── test/                              # 系统、契约、回归和边界测试
├── test-artifacts/                    # Chrome 截图、清单和源码指纹
└── index.html                         # Web 入口
```

`src/systems/` 只有 13 个一级目录是正确的：系统边界不等于同级文件夹。16 条责任线还包含跨切面的 `foundation-runtime`（`src/engine-core/`）、`platform-services`（平台契约/服务/实现）和 `integration-quality`（composition root、脚本、CI 与治理文件）。禁止为了“目录数对齐”创建空系统或搬迁稳定入口。

### 16 条责任线到目录的映射

| `systemId` | 主要真实目录/文件 | 公共入口 | 状态切片 | 迁移状态 |
|---|---|---|---|---|
| `foundation-runtime` | `src/engine-core/`（除 `events.js`）、`src/game-clock.js` | `src/engine-core/public.js` | `foundation` | active |
| `content-pack` | `games/zhaoyun-adou/`（除 `balance.json`、`generated-manifests.js`）、`src/systems/content-pack/` | `src/systems/content-pack/index.js` | 无 | active |
| `match-controller` | `src/systems/match-mode/`、`src/controllers/` | `src/systems/match-mode/index.js` | `match` | active |
| `board-route` | `src/systems/board/` | `src/systems/board/index.js` | `board` | active |
| `piece-model` | `src/systems/piece/` | `src/systems/piece/index.js` | `pieces` | migrating |
| `economy-formation` | `src/systems/economy/` | `src/systems/economy/index.js` | `economy` | active |
| `attribute` | `src/systems/attribute/` | `src/systems/attribute/index.js` | `attributes` | migrating |
| `combat` | `src/systems/combat/` | `src/systems/combat/index.js` | `combat` | active |
| `skill-status` | `src/systems/skill-status/` | `src/systems/skill-status/index.js` | `skillStatus` | active |
| `equipment-items` | `src/systems/equipment-items/` | `src/systems/equipment-items/index.js` | `equipmentItems` | active |
| `stage-encounter` | `src/systems/stage-encounter/` | `src/systems/stage-encounter/index.js` | `encounter` | active |
| `progress-save` | `src/systems/progress-save/` | `src/systems/progress-save/index.js` | `progress` | active |
| `ui-interaction` | `src/systems/ui-interaction/` | `src/systems/ui-interaction/index.js` | app-local `interaction` | active |
| `skin-presentation` | `src/systems/skin-presentation/`、`src/presentation-pack/`、`src/render*.js`、`src/audio.js` | `src/systems/skin-presentation/index.js` | `presentation` | active |
| `platform-services` | `src/platform-contracts/`、`src/platform-services/`、`src/platforms/` | `src/platform-services/public.js` | 无玩法状态 | active |
| `integration-quality` | `src/app-shell/`、组合根、`scripts/`、`.github/`、治理文档 | `src/runtime.js` | 无玩法状态 | active |

表格用于快速定位，不代替机器清单中的精确 `ownedPaths`。新增、删除或移动受治理路径时，必须在同一集成提交中同步机器清单和边界测试。

### 目录规则的维护方式

- 新增、删除或重命名顶层目录、系统目录、`publicEntry` 或责任线时，同一集成提交必须更新本节目录树、16 系统映射、`architecture/system-ownership.json` 和相关边界测试。
- 只增加系统内部实现文件时，不逐文件扩写本目录树；精确所有权继续由机器清单的 `ownedPaths` 表达，避免规则入口膨胀成文件清单。
- 安装、启动、操作或平台支持方式变化时，同时更新 `README.md`；系统职责或迁移状态变化时，同时更新对应架构文档。
- 评审者必须对照真实 `find`/`rg --files` 结果和机器清单复核，不能只因为文档表格“看起来完整”就通过。

## 基线与分支

- `main` 必须始终可发布；系统功能不得直接在 `main` 开发、提交或推送。
- 普通系统分支命名为 `codex/sys-<system>-<feature>`，例如 `codex/sys-board-atomic-swap`。
- 多系统周期集成分支命名为 `codex/integration-game-systems-<cycle>`。
- 每个需求使用独立 worktree；创建前必须核对起始 SHA、现有 worktree 和目标目录状态。
- 系统分支只修改机器清单为本系统声明的 `ownedPaths` 范围及对应专项测试；需要变更 `architecture/system-ownership.json`、跨系统契约或系统边界文档时，拆为集成负责人独立提交。

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

当前 `piece-model` 和 `attribute` 在机器清单中是 `migrating`：前者已负责 ID/revision/location/lifecycle 窄口，但实体仍嵌在 Board/Economy 容器；后者已负责成长适配和 Modifier，但尚无覆盖全实体的完整 StatBlock。系统分支不得在没有迁移计划与全量复验时将它们擅自改为 `active`。

系统边界和开发窗口不一一对应。第一阶段可以由同一维护窗口负责 `piece-model + economy-formation`、`attribute + combat`、`skill-status + equipment-items`，但目录、状态切片和公共入口必须保持独立。

## 强制依赖规则

- 跨系统只能导入目标系统 `publicEntry`；禁止导入其他系统内部文件。
- `engine-core` 不得依赖 Game Pack、ruleset、presentation 或 platform。
- `ContentPackDefinition` 只提供纯可序列化 Manifest；`RuntimeGamePack` 仅由集成根注入编译函数与资源基址，二者都不得携带平台对象。玩法系统不得导入 DOM、Canvas、Audio 或平台 SDK。
- Controller 只产生 GameCommand；规则 handler 才能决定合法性并修改所属切片。
- 一个系统不得直接写另一个系统的状态切片；使用命令、DomainEvent 或窄公共 API。
- DomainEvent 是确定性事实；TelemetryEvent 由服务层派生；PresentationCue 只描述反馈。三者不得混用。
- Telemetry、素材、声音或平台 Adapter 失败不得中断玩法。
- 新命令 handler 由各系统导出并由总分发器组合；重复命令类型必须在启动或测试时失败。

## 协议与状态修改入口

- `GameCommand` 表达 Actor 想做什么，是玩法状态修改的唯一入口；必须可序列化并带稳定版本、actor/side、sequence、tick/time 和纯 JSON payload。
- `DomainEvent` 表达确定性规则已经发生什么，只供系统协作、回放和表现桥接；不得含 DOM、Canvas、平台对象或不可控墙钟。
- `TelemetryEvent` 由应用/服务层从领域结果派生，只做外部统计；失败不得影响玩法，更不得反向驱动规则。
- `PresentationCue` 是只读表现消息；刀光、墨迹、落印属于 Cue，眩晕、光环等会改变规则的效果属于 StatusEffect，两者不得混用。
- `state.js` 只组合系统状态切片；`game-loop.js` 只按受测顺序调用系统；Controller 只产生命令；Renderer 只读 ViewModel/快照并消费 Cue。

## 集成负责人专属文件

以下文件只有当前周期集成负责人可以修改：

- `src/main.js`
- `src/runtime.js`
- `src/state.js`
- `src/game-loop.js`
- `src/game-controller.js`
- `src/input.js`
- `src/ui-layout.js`
- `src/game-pack.js`
- `src/app-shell/`
- `src/engine-core/events.js`（历史 Telemetry 兼容门面，物理位于 engine-core 但不属于 foundation-runtime）
- 总命令分发器组合
- 跨系统公共契约与版本
- `package.json` 测试编排
- `scripts/`、`.github/`、`architecture/`、`docs/architecture/`、`AGENTS.md` 和 `README.md` 治理入口
- `games/zhaoyun-adou/balance.json`
- `games/zhaoyun-adou/generated-manifests.js`

`balance.json` 和 `generated-manifests.js` 是兼容生成物。普通系统分支只改 `games/zhaoyun-adou/sources/balance/` 中对应人工来源；由集成负责人统一运行 `npm run balance:build && npm run game-pack:build` 并检查 diff。`systemUpdateOrder` 逐步记录固定路线模式每 tick 的真实调用顺序；其中 `integration-quality.update-units` 是仍同时协调产粮与单位攻击的兼容步骤，删除前必须先拆清调用方。

## 测试与提交

- 本项目开发服务统一使用 `npm start` 或 `npm run dev -- --port <端口>`；启动器必须是 `scripts/dev-server.mjs`，不得要求维护者安装 Python、修改启动文件或直接运行其他临时静态服务器。
- 每项代码改动遵循 RED → GREEN → REFACTOR；先补失败测试。
- 系统分支至少运行清单中的 `requiredTests`、`npm run test:boundaries` 和 `npm run game-pack:validate`。
- 集成分支必须运行 `npm run balance:build && npm run game-pack:build` 后确认生成物同步，再运行 `npm test`。
- 修改 `index.html`、`package.json`、`assets/`、`games/`、`src/` 或 `test/` 后，必须重新采集真实 Chrome 截图并更新指纹，不能只改清单。
- 每阶段形成可审查的中文提交；跨系统契约变更必须单独提交并列出受影响系统。
- 只 `git add <明确文件>`；禁止 `git add .`、`git add -A`、force push 和 AI 署名。
- `compatibilityFacades[].realCallers` 是精确文件路径，边界测试会与真实反向导入做全量对比；增删调用方必须同步清单。

## 合入顺序

1. 从统一基线 SHA 创建独立 worktree 和 `codex/sys-*` 分支。
2. 只修改所属路径并运行专项门禁。
3. 推送系统分支并提交到 `codex/integration-game-systems-*` 的 PR。
4. 集成负责人重建生成物、处理接线并运行全量/Chrome 复验。
5. 集成分支全绿后才申请合入 `main`；本仓库没有真实 CODEOWNERS 账号前不得虚构。

CI 同时对目标为 `main` 或 `codex/integration-game-systems-*` 的 PR 运行全部质量门禁，普通系统分支不得绕过周期集成复验。

## 当前平台边界

- `games/zhaoyun-adou/game.json` 的 `targetPlatforms` 当前只能是 `web`，正式实现也只有 `src/platforms/web/`。
- “微信小程序”和“微信小游戏”不是同一运行形态；本 Canvas 游戏未来适配目标是微信小游戏。当前仓库既不能直接作为普通小程序页面部署，也没有可上传的微信小游戏工程。
- `probes/wechat-minigame/` 仅用于核对 Canvas、触控、音频、存储、生命周期等能力；它不构成微信小游戏构建产物，也不能直接上传发布。
- 进入微信小游戏 V2.2 前，至少还需新增独立 `src/platforms/wechat/` Host、小游戏 composition root/项目配置/构建输出、资源与音频适配，并完成微信开发者工具和 iOS/Android 真机验证。
- 在上述能力通过契约、行为和真机验收前，不得把 `wechat-minigame` 写入 `targetPlatforms`，也不得在玩法系统内添加 `typeof wx` 或平台分支。
- 微信探针的已验证与未验证证据以 `docs/wechat-minigame-capability-probe.md` 为准。

## 当前已知迁移债务

- `piece-model` 尚未建立覆盖棋盘与营栏的 Piece 中央注册表，实体仍嵌在 Board/Economy 容器。
- `attribute` 尚未形成覆盖英雄、敌人和装备的完整 StatBlock/base/growth 引用模型。
- 兼容门面的精确调用方和删除条件只维护在 `architecture/system-ownership.json.compatibilityFacades`；有调用方时不得为追求目录整齐而删除。
- 处理迁移债务必须保持五关结果、固定 seed 状态哈希、旧存档键和视觉截图一致；不能在普通功能提交中顺手完成大迁移。

## 完成定义

- 改动只落在获授权的 `ownedPaths`，跨系统导入只走 `publicEntry`，没有新增平台泄漏或越权状态写入。
- 系统 `requiredTests`、Pack 校验和边界门禁通过；集成改动还需全量 `npm test` 与生成同步检查。
- `index.html`、`package.json`、`assets/`、`games/`、`src/` 或 `test/` 的源码指纹变化已用真实 Chrome 重采截图，旧证据未冒充新结果。
- `git diff --check` 通过，暂存内容逐文件核对，没有误带其他 worktree 或用户改动。
- 交付说明明确列出完成/未完成、测试证据、兼容影响和准确基线 SHA；未经授权不提交、不推送、不合并共享分支。
