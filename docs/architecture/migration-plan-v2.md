# 模块化基座迁移计划 V2

## 基线

- 候选提交：`9796962a76cdc222b94d2e1fce6d165ba1843509`。
- Game Pack 校验与生成同步通过。
- 完整测试在截图测试前的所有项目均通过，包括确定性、Host 三次销毁和前五关。
- 候选提交自带截图指纹缺陷：manifest 为 `2f53f22d…`，同一提交实际计算为 `a02a2473…`。最终源码稳定后必须真实重采，禁止只改 fingerprint。

## 迁移原则

1. 兼容门面优先，禁止大爆炸重写。
2. 每阶段先写失败测试，阶段测试通过后形成独立中文提交。
3. 新系统必须接入真实生产调用；没有真实数据或行为时不创建 Bot、Remote、装备槽等空实现。
4. 跨系统契约变更单独提交；生成物只由集成负责人更新。
5. 任一阶段出现不可控五关、存档或视觉回归时停止扩张并保留门面。

## 实际执行记录

| 阶段 | 状态 | 提交 | 真实落点 |
|---|---|---|---|
| A | 完成 | `f087d63cd8cd2dc6b1c4633018f0d2c1900d1716` | 架构证据、所有权清单、边界门禁、CI/PR 约束 |
| B | 完成 | `413f09d9f2dffefb120bca019a9a3f0a0d7d7612` | GameCommand/DomainEvent/Telemetry 分层、切片状态、Modifier |
| C | 部分完成（可运行迁移态） | `d093f274032ee86ec4ae55aa461a8af6c9e2432e` | Board/Route 完整落地；Piece/Attribute 已进入真实生产调用，仍保留实体/StatBlock 债务 |
| C 契约加固 | 完成 | `c179c7086eddc4542f4379df3d1c3fd5136e1f6f` | 确定性领域事件路由 |
| D | 完成 | `25a6fdc58710e57abdfda833934176039148ef10` | Economy/Combat/Skill/Equipment/Encounter/Progress 及 SaveEnvelope |
| E | 完成 | `97e94edd48d72fa621ef1836db07a336805cea50` | UI/Interaction 与 Skin/Presentation 分离 |
| F 契约加固 | 完成 | `45ca2c245ed5f6963cd407924b2cc715a6ac0d7e` | 对局授权、序列号与模拟时钟窄口 |
| F | 完成 | `1d003321fb5c06c578d69502a1e85f458ff03545` | 固定路线 MatchMode 与 LocalPlayerController 真实接入 |
| G | 执行中 | 本轮集成提交 | 公共入口、平台窄口、零深导入例外；提交后回填 SHA 和 Chrome 证据 |

## 阶段 A：证据与门禁

- 新增三份架构文档、项目 `AGENTS.md`、PR 模板和 CI。
- 建立 `architecture/system-ownership.json`，机器记录所有权、状态、依赖、命令、事件和测试。
- 新增递归 import/平台泄漏/公共入口门禁。
- 提交建议：`架构: 建立系统所有权与多人维护门禁`。

## 阶段 B：基础协议与状态组合

- 保持 GameCommand 1.0.0；增加 handler map 组合器并拒绝重复 type。
- 新增 DomainEvent 1.0.0 每 tick 队列；现有 reporter 明确为 Telemetry。
- 新增 Telemetry bridge，失败隔离且不影响玩法。
- 各系统提供真实状态工厂；`state.js` 只组合，旧顶层字段通过兼容访问器映射。
- 新增 StatModifier 的稳定排序和确定性叠加协议。
- 提交建议：`架构: 分离命令领域事件与状态切片契约`。

## 阶段 C：Board、Piece、Attribute

- Board 从 levels 构建拓扑、路线、入口、终点和 occupancy。
- Piece 已统一 troop/frag/hero/tool 的稳定 ID、revision、location、升级与消耗操作；实体仍嵌入 `board.grid` / `economy.bench`，未建中央注册表。
- Attribute 已负责现有兵种成长、Modifier 与最终查询；英雄/敌人/装备的完整 StatBlock 仍待后续迁移。
- 旧 `map.js`、`logic.js`、`units.js` 保留转发门面并记录调用方。
- 提交建议：`重构: 提取棋盘弈子与属性系统`。

## 阶段 D：玩法系统与存档

- 拆 Economy/Formation、Combat、Skill/Status、Equipment/Items、Stage/Encounter。
- 火龙先成为 Skill/Combat 领域实体，再发 PresentationCue；眩晕/光环使用 StatusEffect。
- Split balance 人工来源，由编译器生成兼容 `balance.json` 和 `generated-manifests.js`。
- Progress 建立 ProfileProgress、SaveEnvelope、MatchSnapshot/Replay schema；继续读取和兼容写入 `zyad_cleared_stars`、`zyad_best`。
- 提交建议：`重构: 提取战内规则与版本化存档系统`。

## 阶段 E：UI 与表现

- UI 负责语义布局、命中、只读 ViewModel 和输入意图映射。
- LocalPlayerController 不再导入 `logic.js` 或 ruleset 内部。
- Gameplay 只发 PresentationCue；Presentation 复用现有 Canvas 绘制保持像素结果。
- Platform 不再导入 presentation 或具体 Game Pack。
- 提交建议：`重构: 分离交互视图与皮肤表现`。

## 阶段 F：真实 MatchMode

- 将现有选关、固定路线、重试、退出、结算提为 `fixed-route-campaign`。
- 模式声明 player actor/side 和命令授权；LocalPlayerController 是唯一真实 Controller。
- 不创建 ScriptedBot、Replay、Remote 空文件。
- 提交建议：`重构: 接入固定路线对局模式与控制器契约`。

## 阶段 G：最终装配与证据

- Runtime/App Shell 只经系统公共入口、机器登记的兼容门面或 composition root 接线，并明确更新顺序。
- 总 dispatcher 只组合 handler maps；`state.js` 只组合切片。
- 运行生成同步、专项测试、完整 `npm test`。
- 按端口规则启动独立服务，在 Chrome 重跑五关、关键操作和截图清单。
- 更新 19 个文件级兼容门面的精确调用方/删除条件；边界测试对 `realCallers` 做反向导入全量比对。
- 将生产源码、Pack、脚本、GitHub 工作流、机器清单和架构文档统一纳入 `governedPaths`，要求每个受治理文件恰好一个 owner。
- 提交建议：`集成: 收口模块化基座并更新回归证据`。

Phase G 代码收口与截图证据分为两个可审查提交：先固定最终源码指纹，再采集真实 Chrome 产物。不会为了一个提交而混合代码与大量二进制截图。

## 退出条件

- 每个 active 系统有公共入口、独立状态切片或明确无玩法状态、真实生产调用和专项测试。
- 非法依赖、deep import、平台泄漏与表现反向依赖能自动失败。
- Game Pack、旧存档、SaveEnvelope、固定 seed、Host 三次销毁和五关全绿。
- Chrome 新截图指纹与最终源码一致；`main` checkout 和 SHA 未变化。

## 已知未完成项

- `piece-model` 尚未成为所有弈子实体的唯一注册表；删除 flat state 前必须完成所有消耗/转移路径的 lifecycle 和引用迁移。
- `attribute` 尚未提供覆盖全实体的 StatBlock/base/growth 引用模型。
- `getStateSnapshot()` 现为受控 V2 诊断快照，并在 `runtimeSlices` 中补充确定性私有状态；它不伪造候选提交内部 `bob/cd/flash/projectile.target/dragon.hit` 的 raw 对象形状。若外部消费者要求 9796962 raw snapshot ABI，必须以独立版本化适配层完成，不得把纯表现字段写回玩法 hash/save。
