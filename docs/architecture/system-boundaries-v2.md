# 系统边界 V2：证据、推导与结论

输入基线：`9796962a76cdc222b94d2e1fce6d165ba1843509`。本文件描述稳定目标边界及 Phase G 的真实落点；机器事实以 `architecture/system-ownership.json` 为准。

## 1. 真实代码证据

| 证据 | 推导 | 设计结论 |
|---|---|---|
| `src/state.js:13-69` 在一个对象中混放标题、时间、资源、棋盘、营栏、英雄、敌人、弹道、特效、Buff、波次、进度和统计 | 获得 `state` 的模块能写任意领域，目录边界无法形成状态所有权 | `state.js` 最终只组合命名切片；旧顶层字段仅保留可追踪兼容投影 |
| `src/game-loop.js:1-7` 直接导入敌人、弈子、英雄、效果和道具；`12-26` 知道洛阳铲 ID 并硬编码执行 | 主循环同时承担集成顺序和具体规则 | 固定路线 MatchMode 组合各系统公开 `update`；总循环不解释内容 ID |
| `src/runtime.js:4-17` 同时导入 ruleset、表现和音频注册表；`24-100` 完成绑定校验和装配 | 它是 composition root，不是 engine-core | 归 `integration-quality`；foundation 只保留纯契约和确定性工具 |
| `src/engine-core/game-command.js:34-80` 已有稳定 ID、actor/side、sequence、tick/time 和纯数据 payload；`118-153` 有拒绝、哈希和日志 | GameCommand 基础可保留 | 各系统导出 handler map；总组合器拒绝重复 type，MatchMode 先授权 |
| `src/rulesets/merge-defense/player-command-dispatcher.js:12-29、60-269` 一个 map 横跨关卡、经济、交互、棋盘、英雄、道具与结果 | 命令协议稳定，但处理所有权不清 | 按系统拆 handler；该文件最后只组合，不再含领域写入 |
| `src/controllers/local-player-controller.js:4-5、16-33` 深层导入 `logic.js` 和布局并预判合成；`74-175` 直接读取完整状态 | Controller 不只是命令生产者 | 命中/意图归 UI，合法性归 handler；Controller 只订阅标准输入并提交命令 |
| `src/game-controller.js:20-93` 已实现选关、开始、重试、退出和结果流转 | 固定路线战役是未命名的真实模式 | 提取 `fixed-route-campaign` MatchMode，不创建 Bot/Remote 空实现 |
| `src/engine-core/events.js:190-263` 使用墙钟、sessionId、版本、外部 sink；`134-139` 使用 `Date.now/randomUUID` | 当前 reporter 是 Telemetry，不是确定性 DomainEvent | 新增每 tick 领域队列；服务层从领域事实派生现有统计事件 |
| `src/actions.js:12-38`、`src/enemies.js:54-105`、`src/heroes.js:59-61` 规则直接发统计事件 | 统计命名渗入规则 | 规则只发布 DomainEvent；Telemetry 映射失败不反向影响玩法 |
| `src/rulesets/merge-defense/skill-registry.js:2-4、7-40` 同时结算伤害/眩晕/Buff并创建圆环、刀光、火龙、箭雨 | 技能规则和表现耦合 | 眩晕/光环归 StatusEffect；刀光/圆环归 PresentationCue |
| `src/effects.js:40-50` 把火龙放进特效数组，`src/heroes.js:64-80` 又用该对象结算伤害 | 火龙目前既是视觉对象又是伤害实体，不能直接搬走 | 先提取确定性技能领域实体，再从其事件派生火龙表现 |
| `src/map.js:27-75` 构造真实拓扑；`src/rulesets/merge-defense/unit-placement.js:47-104` 已有原子移动/交换/合成 | Board 有可复用实现，但格子直接持有可变 Unit | Board 拥有 occupancy，Piece 拥有实体；跨 bench/grid 先全校验再窄提交 |
| `games/zhaoyun-adou/balance.json:5-22、23-68、69-158、159-193` 同时承载经济、兵种、英雄/技能、敌人、波次、道具 | 多个维护者会竞争一个文件 | 人工来源按系统拆分，集成编译兼容 `balance.json` 和生成模块 |
| `games/zhaoyun-adou/theme.json:55-67` 与 `src/ui-layout.js:8-20` 重复布局；测试仅校验相等 | Skin 的 layout 不是实际唯一热区来源 | 语义布局归 UI；Theme 仅保留视觉 token，兼容字段有调用清零条件 |
| `src/presentation-pack/board-interaction-overlay.js:2` 和 `src/render-battle-controls.js:6` 深导入 ruleset 内部 | 表现反向依赖具体玩法实现 | UI 生成目标预览 ViewModel；表现只画 `valid/move/swap/merge/invalid` |
| `src/campaign.js:24-43、64-80` 同时处理 Storage 和 Match state；`src/app-shell/create-game-app.js:112-117` 另写最佳波次 | 永久进度、平台 I/O、对局结算分散且只有裸 key | 建立 SaveEnvelope/ProfileProgress；旧键继续兼容读写，平台只提供端口 |
| `src/app-shell/create-game-app.js:158-209` 正确装配 Host/Runtime/Controller/循环，但 `101-124` 仍直接推进规则与结算 | App Shell 位置正确，职责过宽 | 最终只调用 Match、Progress、ViewModel、Presentation 的公共入口 |

## 2. 稳定系统表

| 系统 | 拥有状态 | 负责 | 明确不负责 | 允许依赖 |
|---|---|---|---|---|
| foundation-runtime | `foundation` | Command、DomainEvent、Registry、RNG、tick/sequence/hash/version | 题材、数值、渲染、平台 | 无具体系统 |
| content-pack | 无 | 纯数据、Schema、引用、版本和编译 | 状态写入、规则执行、平台加载 | foundation 契约 |
| match-controller | `match` | mode 生命周期、actors/sides、授权与结果 | 棋盘、伤害、网络、UI 绘制 | foundation、progress 公共入口 |
| board-route | `board` | 拓扑、路线、occupancy、原子移动/交换 | 伤害、经济、动画、热区 | foundation、content、piece |
| piece-model（迁移中） | `pieces` | 已接入 ID/revision/location/升级/消耗窄口；目标仍是完整生命周期与稳定引用 | 抽取、伤害、画法 | foundation、content |
| economy-formation | `economy` | 资源、征兵、营栏、合成、拼字和编队 | 永久进度、属性、战斗、渲染 | foundation、content、board、piece、skill 公共入口 |
| attribute（迁移中） | `attributes` | 已接入兵种成长、Modifier 和最终值；完整 StatBlock 仍是目标 | 索敌、攻击、技能触发、装备持有 | foundation、content |
| combat | `combat` | 索敌、攻击、Damage、投射物、死亡 | 技能触发、装备槽、特效 | foundation、board、piece、attribute |
| skill-status | `skillStatus` | 技能、冷却、Buff/Debuff 和玩法效果 | 装备槽、素材、动画、音效 | foundation、content、board、piece、attribute、combat |
| equipment-items | `equipmentItems` | 当前真实道具及未来装备扩展点 | 第二套属性/伤害算法、动画 | foundation、content、board、piece、attribute、skill、economy |
| stage-encounter | `encounter` | 波次、出生、Boss、局内胜负 | 永久存档、皮肤 | foundation、content、board、piece、combat |
| progress-save | `progress` | Profile、Envelope、迁移、Replay/Snapshot 协议 | 平台 API、运行关卡 | foundation、content；Storage 是运行注入 port |
| ui-interaction | app-local `interaction`（不进入 gameplay state/hash/save） | ViewModel、布局、命中、意图→Command | 规则合法性、玩法写入、皮肤 | foundation；玩法只读 query 由 integration 注入 |
| skin-presentation | `presentation` | Renderer、主题、动画、音频/表现 Cue | 热区、逻辑坐标、伤害、胜负 | foundation、content、ui；Host 是运行注入 port |
| platform-services | 无玩法状态 | Host 能力和平台实现 | 规则、题材、Bot | foundation |
| integration-quality | 无玩法状态 | 总装配、顺序、生成物、测试、CI | 新玩法 | 各系统公共入口 |

系统边界保持细且稳定；开发窗口可临时合并相邻责任，但不得重新合并目录、状态切片或公开 API。

16 个系统都有公开入口和真实调用；其中 14 个为 `active`，`piece-model` 与 `attribute` 为 `migrating`：

| 系统 | `publicEntry` | 系统 | `publicEntry` |
|---|---|---|---|
| foundation-runtime | `src/engine-core/public.js` | content-pack | `src/systems/content-pack/index.js` |
| match-controller | `src/systems/match-mode/index.js` | board-route | `src/systems/board/index.js` |
| piece-model | `src/systems/piece/index.js` | economy-formation | `src/systems/economy/index.js` |
| attribute | `src/systems/attribute/index.js` | combat | `src/systems/combat/index.js` |
| skill-status | `src/systems/skill-status/index.js` | equipment-items | `src/systems/equipment-items/index.js` |
| stage-encounter | `src/systems/stage-encounter/index.js` | progress-save | `src/systems/progress-save/index.js` |
| ui-interaction | `src/systems/ui-interaction/index.js` | skin-presentation | `src/systems/skin-presentation/index.js` |
| platform-services | `src/platform-services/public.js` | integration-quality | `src/runtime.js` |

## 3. 三种协议

| 协议 | 含义 | 必含 | 禁止 |
|---|---|---|---|
| GameCommand | Actor 想做什么 | apiVersion、type、actor/side、sequence、tick/time、纯 payload | DOM、Canvas、SDK 对象和直接状态引用 |
| DomainEvent | 确定性规则已经发生什么 | apiVersion、type、source、sequence、tick、纯 payload | 墙钟、session、隐私字段和外部 sink 结果 |
| TelemetryEvent | 对外统计什么 | 游戏/规则/内容版本、session、occurredAt、结果和失败原因 | 反向控制玩法或改变随机序列 |

PresentationCue 是第四种只读表现消息；它不等同 StatusEffect，也不进入玩法哈希。

所有权清单只记录已有真实源码落点的 DomainEvent/PresentationCue。属性修改、进度加载或交互意图等尚未发布领域事件的能力不会以“未实现声明”写成已有能力；边界测试会拒绝没有源码字面落点的事件/Cue ID。

## 4. Phase G 实际落点

| 证据 | 推导 | 结论 |
|---|---|---|
| `src/state.js:17-43,113-125` 声明切片归属并组合各系统公开状态工厂；`src/engine-core/state-slices.js:39-49` 只负责装配扩展 | 旧顶层形状已成为可追踪投影，系统私有字段由其状态工厂定义 | `state.js` 是集成组合根，不是新规则归属地 |
| `src/rulesets/merge-defense/player-command-dispatcher.js:99-152` 组合 Match、UI、Economy、Equipment 和 Encounter handler map | 状态修改继续只有一个 GameCommand 入口，重复 type 由基座组合器拒绝 | 总 dispatcher 只负责接线，各系统 handler 拥有规则 |
| `src/systems/content-pack/index.js:5-17` 只冻结 Manifest；`src/game-pack.js:7-14` 才注入规则编译器和资源基址 | `ContentPackDefinition` 是纯数据，`RuntimeGamePack` 是集成产物 | Game Pack 数据边界与运行时装配边界已分开 |
| `src/systems/board/index.js:108-121` 通过外部位置 port 访问营栏；`src/systems/economy/formation.js:39-43` 提供该窄口 | Board 不再知道 Economy 的 `bench` 数据结构 | bench↔grid 原子事务由 Board 执行，但营栏状态仍由 Economy 拥有 |
| `src/systems/economy/recruitment.js:22-60` 以 `onItemRecruited` 通知道具系统；`src/systems/economy/formation.js:113-136` 通过 Skill 公共入口登记英雄 | Economy 不再直接写 Equipment/Skill 切片 | 跨系统协作改为显式 port/窄公共 API，保留原抽取与拼将语义 |
| `src/systems/progress-save/state.js:11-33` 独占进度投影；`src/systems/skin-presentation/feedback-state.js:29-77` 独占命中/浮动反馈 | App Shell、战斗和弈子无需回写 Progress/Presentation 所有字段 | 永久进度与纯表现反馈已从跨系统直写收口到各自 owner |
| `test/state-ownership-boundary-test.mjs:21-140` 将机器清单映射到点号/括号直接写入、切片访问和已知别名越权 | 无解析器的正则不能证明计算属性或任意对象别名都安全，但能覆盖当前已知危险写法 | `npm run test:boundaries` 提供最低自动门禁；代码审查仍须检查计算属性、别名写入和新增窄口 |
| `src/runtime.js:76-131` 同时创建 DomainEvent queue、PresentationCue queue 和单向 Telemetry bridge | 三种消息的时钟、目的和失败边界已分开 | Telemetry sink 失败不反向影响确定性玩法 |
| `src/systems/match-mode/fixed-route-campaign.js:139-312` 实际拥有选关、开局、重试、退出、授权、推进和结算 | MatchMode 已经是真实运行实现，不是 Bot/Remote 空接口 | 当前只有 `fixed-route-campaign + LocalPlayerController` |
| `src/controllers/local-player-controller.js:1-46` 只构造/提交 GameCommand，不读写完整玩法状态 | 未来 Controller 可复用同一契约而不复制规则 | 本轮不建 Bot/Replay/Remote 空实现 |
| `src/app-shell/create-game-app.js:40-66,163-268` 组合 Pack、Host、Runtime、Progress、Controller、循环与销毁 | App Shell 是唯一应用装配壳，平台失败通过 Adapter 降级 | 平台和玩法不复制启停/销毁逻辑 |
| `architecture/system-ownership.json` 的 `temporaryImportExceptions` 为空，14 个系统为 `active`、2 个为 `migrating`，19 个兼容门面均标记 `retained / lastReviewedPhase: G` | 迁移期深导入已清零，但 Piece/Attribute 的模型完整度不被路径门禁伪装成已完成 | 新系统分支只导入 `publicEntry`，并按 `remainingMigration` 清理真实债务 |
| `governedPaths` 覆盖 `src/**`、Game Pack、`scripts/**`、`.github/**`、`architecture/**`、`docs/architecture/**` 及仓库根治理文件 | CI、脚本和边界文档也会改变多人维护规则，不能游离于 owner 检查外 | 受治理文件必须恰好归属一个系统，工程治理路径由 integration-quality 拥有 |

## 5. 仍保留的兼容面

`architecture/system-ownership.json.compatibilityFacades` 是机器可读的完整清单，并记录真实调用方、委托目标和删除条件。下表是人类审查摘要：

| 兼容面 | 保留原因 | 可删除条件 |
|---|---|---|
| `src/config.js`、`src/map.js`、`src/actions.js`、`src/logic.js` | 旧玩法/测试仍使用原 API | 生产和兼容测试全部转入所有系统公开入口 |
| `src/enemies.js`、`src/units.js`、`src/heroes.js` | 固定路线循环与历史压力测试共用兼容调度函数 | MatchMode 以系统 port 完成同序调度，且截图/数值全部一致 |
| `src/game-controller.js`、`src/input.js`、`src/ui-layout.js` | App Shell 与历史控制/热区测试仍依赖旧函数名 | 共享集成工厂与 UI 公开入口替代所有调用方 |
| `src/engine-core/events.js`、`game-command-source.js` | 旧统计/输入合同测试仍需要原导出；其中 `events.js` 虽物理位于 engine-core，因使用墙钟与外部 sink 而机器归属 integration-quality | 调用方全部改用 Foundation/Platform 公开入口 |
| `src/rulesets/merge-defense/unit-placement.js`、`src/campaign.js` | 旧摆放、存档与关卡测试仍需兼容 API | Economy/Board/Progress/Match 的公开口径完全覆盖 |
| `src/field-tools.js`、`src/rulesets/merge-defense/{effect,item,skill}-registry.js`、`compile-config.js` | 历史道具/Registry/Game Pack 兼容测试与默认 Pack 装配仍有精确调用 | 调用方全部改用 Equipment/Skin/Skill/Content 公开入口 |
| flat `state.*`、`state.path`、`theme.layout` | 保持五关、旧快照、旧包和像素结果 | 只读 ViewModel/新包 schema 完成版本迁移且兼容访问为零 |
| `getStateSnapshot()` V2 诊断投影 | 保留 flat 玩法字段并补充 `runtimeSlices`，但不把已分离的表现对象写回玩法状态 | 若存在依赖 9796962 raw 内部形状的外部调用方，先以固定 fixture 建独立版本化适配器 |
| 旧存档键 | 必须继续读取现有玩家进度 | 长期保留迁移 reader，无预设删除日期 |
| `balance.json`、`generated-manifests.js` | 原生 ES Module 无构建启动需要兼容编译/机械生成视图 | 仍由集成负责人生成，不作为手工内容源 |

## 6. 明确保留的硬编码

- `src/game-loop.js:1-16` 仍通过旧 enemy/unit/hero 更新门面保持候选基座的系统顺序；删除前必须用五关数值与截图证明新 port 同序。
- `src/game-loop.js:21-30` 仍识别 `luoyang-shovel`/`shovel`；这是当前唯一内容包的兼容反馈接线，不向新规则扩展。
- `src/render-theme.js:5-8` 的字体由 `theme.fontFamily` 驱动；仅保留候选字体串作为旧包兼容回退，因此默认像素不变，第二 Skin 可替换字体而无需修改 Renderer。
- `src/systems/piece/index.js:6,41-119` 只完成序列、身份、revision、location 与 lifecycle 操作；实体本体仍位于 Board/Economy 容器。
- `src/systems/attribute/index.js:6-80` 已有确定性 Modifier 与兵种成长查询，但不是覆盖全实体的 StatBlock。
