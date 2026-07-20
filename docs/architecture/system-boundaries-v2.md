# 系统边界 V2：证据、推导与结论

基线：`9796962a76cdc222b94d2e1fce6d165ba1843509`。本文件描述稳定目标边界；机器事实以 `architecture/system-ownership.json` 为准。

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
| piece-model | `pieces` | 身份、类型、等级、位置引用和生命周期 | 抽取、伤害、画法 | foundation、content |
| economy-formation | `economy` | 资源、征兵、营栏、合成、拼字和编队 | 永久进度、属性、战斗、渲染 | foundation、content、board、piece |
| attribute | `attributes` | StatBlock、成长、Modifier 和最终值 | 索敌、攻击、技能触发、装备持有 | foundation、content |
| combat | `combat` | 索敌、攻击、Damage、投射物、死亡 | 技能触发、装备槽、特效 | foundation、board、piece、attribute |
| skill-status | `skillStatus` | 技能、冷却、Buff/Debuff 和玩法效果 | 装备槽、素材、动画、音效 | foundation、content、board、piece、attribute、combat |
| equipment-items | `equipmentItems` | 当前真实道具及未来装备扩展点 | 第二套属性/伤害算法、动画 | foundation、content 及公开扩展点 |
| stage-encounter | `encounter` | 波次、出生、Boss、局内胜负 | 永久存档、皮肤 | foundation、content、board、combat、economy |
| progress-save | `progress` | Profile、Envelope、迁移、Replay/Snapshot 协议 | 平台 API、运行关卡 | foundation、content、Storage port |
| ui-interaction | `interaction` | ViewModel、布局、命中、意图→Command | 规则合法性、玩法写入、皮肤 | foundation 与各系统只读 query |
| skin-presentation | `presentation` | Renderer、主题、动画、音频/表现 Cue | 热区、逻辑坐标、伤害、胜负 | ViewModel、content、Host ports |
| platform-services | 无玩法状态 | Host 能力和平台实现 | 规则、题材、Bot | Host 契约 |
| integration-quality | 无玩法状态 | 总装配、顺序、生成物、测试、CI | 新玩法 | 各系统公共入口 |

系统边界保持细且稳定；开发窗口可临时合并相邻责任，但不得重新合并目录、状态切片或公开 API。

## 3. 三种协议

| 协议 | 含义 | 必含 | 禁止 |
|---|---|---|---|
| GameCommand | Actor 想做什么 | apiVersion、type、actor/side、sequence、tick/time、纯 payload | DOM、Canvas、SDK 对象和直接状态引用 |
| DomainEvent | 确定性规则已经发生什么 | apiVersion、type、source、sequence、tick、纯 payload | 墙钟、session、隐私字段和外部 sink 结果 |
| TelemetryEvent | 对外统计什么 | 游戏/规则/内容版本、session、occurredAt、结果和失败原因 | 反向控制玩法或改变随机序列 |

PresentationCue 是第四种只读表现消息；它不等同 StatusEffect，也不进入玩法哈希。

## 4. 兼容门面

| 门面 | 当前调用方 | 删除条件 |
|---|---|---|
| `src/config.js` / `gamePack.config` | state、map、campaign、logic、unit、hero、layout 与旧测试 | 生产调用全部改用系统配置且测试不再读取 `CONFIG` |
| flat `state.*` | 规则、renderer、快照和测试 | 系统只写自己的切片，renderer 只读 ViewModel，兼容访问计数为零 |
| `src/game-controller.js` | dispatcher、app-shell 和控制链测试 | fixed-route MatchMode 成为唯一生产入口 |
| `src/engine-core/events.js` | 旧统计测试与兼容调用 | 全部生产调用转到 DomainEvent + Telemetry bridge |
| `state.path` | enemy、route overlay 和旧测试 | 所有包、回放和调用方使用 `paths` |
| `theme.layout` | Pack 同步测试 | UI layout source 生效且 schema 完成版本迁移 |
| 旧存档键 | 现有玩家数据 | 长期保留迁移 reader；没有预设删除日期 |
| `generated-manifests.js` | 浏览器无构建加载 | 继续作为集成生成物，不是系统分支人工来源 |
