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
- Piece 统一 troop/frag/hero/tool 身份与等级，不执行经济或伤害。
- Attribute 负责基础值、等级成长、Modifier 与最终查询。
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

- Runtime/App Shell 只导入公共入口并明确更新顺序。
- 总 dispatcher 只组合 handler maps；`state.js` 只组合切片。
- 运行生成同步、专项测试、完整 `npm test`。
- 按端口规则启动独立服务，在 Chrome 重跑五关、关键操作和截图清单。
- 更新兼容层调用方/删除条件；无法安全删除的继续保留。
- 提交建议：`集成: 收口模块化基座并更新回归证据`。

## 退出条件

- 每个 active 系统有公共入口、独立状态切片或明确无玩法状态、真实生产调用和专项测试。
- 非法依赖、deep import、平台泄漏与表现反向依赖能自动失败。
- Game Pack、旧存档、SaveEnvelope、固定 seed、Host 三次销毁和五关全绿。
- Chrome 新截图指纹与最终源码一致；`main` checkout 和 SHA 未变化。
