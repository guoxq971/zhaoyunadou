# AI 游戏生产基座：关键词与执行边界

> 用途：把《赵云与阿斗》从单款 AI 游戏原型，逐步沉淀成可生成、可替换、可测试、可上线、可运营的同品类游戏生产基座。
>
> 阅读对象：负责后续架构设计、代码拆分、第二版本验证和上线体系建设的执行窗口。

## 1. 一句话目标

保留《赵云与阿斗》的独特核心——**汉字拼将 + 双路塔防**，把运行时、规则、内容、表现和平台服务拆出稳定边界；先验证“同品类复用”，暂不建设万能游戏引擎。

## 2. 决策关键词

- **同品类基座**：先服务网格、合成、抽取、塔防这一类游戏。
- **内容包驱动**：换题材、角色、关卡、文案、美术和音乐时，不修改核心引擎。
- **规则集复用**：征兵、放置、合成、波次、索敌、技能和结算形成可组合模块。
- **Schema 优先**：AI 生成的数据必须先通过结构校验，再进入运行时。
- **注册表代替分支**：技能、道具、效果、音效使用 `id -> handler/renderer/audioCue` 注册关系。
- **AI 生成，人审放行**：AI 产物不是直接上线产物，必须经过规则、视觉、听感、权利和真机验收。
- **数据先于变现**：先证明玩家愿意开始、完成、重试和回来，再建设皮肤、会员、广告和支付。
- **第二版本验证抽象**：下一款同规则、不同题材的游戏是基座的第一次真实验收。
- **三次复用再平台化**：连续三个已发布版本都使用的能力，才升级为跨游戏公共层。
- **可回滚发布**：上线不等于完成；版本、监控、灰度和回滚属于产品能力。

## 3. 五层边界

| 层 | 关键词 | 包含内容 | 不应包含 |
| --- | --- | --- | --- |
| `engine-core` | 运行时 | 时钟、主循环、场景生命周期、输入、适屏、存储接口、资源加载、事件总线 | 赵云、阿斗、巨鹿、馒头等题材信息 |
| `ruleset` | 品类规则 | 网格、路径、放置、拖拽、合成、抽取、经济、波次、索敌、伤害、技能协议、胜负结算 | 具体英雄名、关卡名、美术和文案 |
| `content-pack` | 游戏内容 | 英雄、敌人、地图、路线、关卡、目标、Boss、数值、奖励、教学节拍 | 浏览器 API、支付和平台登录 |
| `presentation-pack` | 表现内容 | 主题色、字体、布局令牌、图片、动画、特效、BGM、SFX、文案、反馈映射 | 核心战斗计算和玩家权益 |
| `platform-services` | 上线运营 | Web/微信/抖音适配、账号、云存档、远程配置、埋点、监控、排行榜、支付、广告、权益 | 某一款游戏的角色和关卡细节 |

建议目录语义：

```text
engine-core/
  runtime/
  adapters/
  presentation-primitives/

rulesets/
  merge-defense/

games/
  zhaoyun-adou/
    game.json
    balance.json
    levels.json
    copy.zh-CN.json
    theme.json
    assets/manifest.json
    audio/manifest.json
    events.json

platforms/
  web/
  wechat/
  douyin/

services/
  identity/
  cloud-save/
  analytics/
  remote-config/
  commerce/
```

这只是目标边界，不要求第一轮一次性移动全部文件。

## 4. AI 产物的沉淀方式

统一公式：

> **生成规范 + 机器可读 Manifest + 生成记录 + 自动校验 + 人工验收**

### 4.1 游戏与规则

- `game.json`：游戏 ID、规则集版本、内容版本、目标平台、入口场景。
- `balance.json`：货币、消耗、抽取、单位、敌人、技能、成长和奖励数值。
- `levels.json`：地图、路线、开放格、敌群时间线、特殊目标、Boss 机制和教学步骤。
- `events.json`：必须采集的玩家事件、字段、版本和隐私级别。
- `schemas/*.schema.json`：配置结构、范围、引用完整性和版本兼容规则。
- 自动验收：确定性随机种子、数值模拟、完整通关、坏配置拒绝和存档迁移。

### 4.2 美术

- `theme.json`：颜色、字体、间距、描边、阴影、特效和安全区令牌。
- `assets/manifest.json`：稳定素材 ID、路径、尺寸、格式、用途、加载优先级和回退资产。
- 生成记录：模型、模型版本、提示词、反向提示词、seed、参考来源、生成日期、后处理和文件哈希。
- 权利记录：生成平台、商用范围、参考边界、人工审核人和审核结论。
- 自动验收：尺寸、透明通道、文件体积、引用完整性、截图回归和多尺寸可读性。

### 4.3 音乐与音效

- `audio/manifest.json`：`eventId -> audioCue`、BGM/SFX/UI/环境分组、格式和备用音源。
- 音乐字段：BPM、调性、循环起止点、响度、时长、淡入淡出和压缩规格。
- 运行能力：静音、主音量、分组音量、后台暂停、恢复播放和浏览器自动播放降级。
- 生成记录与美术一致：模型、提示词、seed、来源、授权、后处理、哈希和人审结果。
- 自动验收：可解码、可循环、峰值不过载、移动端体积和长时间播放稳定性。

## 5. “游戏、美术、音乐”之外的关注面

| 优先级 | 关注面 | 关键词 |
| --- | --- | --- |
| P0 | 产品 | 目标玩家、核心乐趣、独特点、单局时长、停止条件 |
| P0 | 关卡内容 | 地图、目标、教学、难度曲线、Boss、奖励、章节节奏 |
| P0 | 玩家体验 | 新手引导、有效反馈、失败解释、设置、无障碍 |
| P0 | 数据 | 开始、有效操作、通关、失败、重试、退出、回流、阵容多样性 |
| P0 | 品质 | 单测、数值模拟、浏览器主流程、截图回归、真机、性能、崩溃 |
| P0 | 发布 | 版本号、构建产物、预发、灰度、监控、告警、回滚 |
| P0 | 权利 | 原创边界、参考来源、AI 平台条款、素材许可、隐私说明 |
| P1 | 服务端 | 匿名玩家 ID、云存档、存档迁移、远程配置、排行榜 |
| P1 | 多平台 | Web、微信、抖音的登录、生命周期、触控、包体和审核差异 |
| P1 | 运营 | 活动配置、公告、客服、反馈入口、版本节奏、社区 |
| P1 | AI 供应链 | 模型稳定性、账号风险、Token 成本、缓存、供应商降级、可复现性 |
| P2 | 商业化 | 皮肤、会员、广告、支付、订单、退款、权益恢复 |
| P2 | 经营分析 | 服务成本、生成成本、投放成本、留存、转化和单用户收入 |

## 6. 首批事件与“好玩”指标

### 6.1 事件关键词

- `session_start` / `session_end`
- `stage_start` / `stage_end`
- `recruit_attempt` / `recruit_result`
- `deploy` / `merge` / `invalid_action`
- `hero_unlock` / `hero_cast`
- `wave_start` / `wave_end`
- `enemy_leak`
- `retry` / `quit`

公共字段：`gameVersion`、`rulesetVersion`、`contentVersion`、`stage`、`wave`、`sessionTime`、`resourceSnapshot`、`result`、`reason`。

### 6.2 指标关键词

- 首局开始率、首次有效操作耗时。
- 第一关完成率、各关失败波次、失败原因分布。
- 单关时长、完整会话时长、重复挑战率、回流率。
- 馒头来源/消耗、营栏满载时长、无效点击/拖放率。
- 兵种与英雄上场率、伤害贡献、击杀贡献、阵容多样性。
- 加载时间、平均帧率、卡顿、异常、崩溃和存档失败率。

自动测试只证明“机械上可运行、可通关”，不能证明“玩家觉得好玩”。指标目标值应在真实玩家基线产生后再确定，不预设万能阈值。

## 7. 当前仓库事实与推导

| 证据 | 推导 | 结论 |
| --- | --- | --- |
| `README.md:14`：无后端、数据库和第三方运行依赖 | 当前是纯前端单机原型 | 尚不是上线运营平台 |
| `src/config.js:15`：关卡、抽取、单位、英雄、敌人和经济已集中 | 已有数据化起点 | 可先拆 `game/balance` Manifest |
| `src/map.js:5`：路线和开放格写死 | 地图不是内容包 | 需要关卡 Schema |
| `src/heroes.js:36`：技能使用固定分支 | 增加技能仍需改引擎 | 需要技能/效果注册表 |
| `src/state.js:53`：已有击杀、合成、招募等统计 | 已有事件字段雏形 | 需要真正采集、发送和看板 |
| `src/main.js:71`：统计只进入 Canvas `dataset` | 当前主要服务测试 | 不能替代玩家埋点 |
| `README.md:77`：进度仅保存在 `localStorage` | 没有跨设备与存档版本能力 | 上线后需云存档和迁移 |
| `src/audio.js:18`：只有 WebAudio 合成短音效 | 尚无音乐内容管线 | 需要音频 Manifest、混音和授权记录 |
| `package.json:7`：已有完整 Node 测试链 | 规则稳定性基础较好 | 应保留并扩展为流水线门禁 |
| `docs/superpowers/specs/2026-07-19-zhaoyun-adou-visual-asset-inventory.md:152`：保留美术生成轮次和提示词 | 已有可追踪实践 | 可升级为统一资产台账 |
| `docs/superpowers/specs/2026-07-19-zhaoyun-adou-visual-quality-test-expansion.md:128`：真机和其他浏览器仍缺 | Chrome 截图不等于多平台完成 | 发布前必须补真机/平台验收 |
| `README.md:109`：仓库未声明许可证 | 权利边界尚未完结 | 商用发布前单独审查源码、名称、参考和素材 |

## 8. 推荐执行顺序

1. **冻结基线**：保留当前可玩版本、测试、截图和源码指纹，不在提炼过程中改变玩法结果。
2. **建立 Schema**：先定义 `game`、`balance`、`levels`、`theme`、`assets`、`audio` 和 `events` 数据契约。
3. **拆第一个内容包**：把《赵云与阿斗》的英雄、敌人、地图、关卡、文案、主题和素材移入 `games/zhaoyun-adou/`。
4. **建立注册表**：技能、道具、效果、渲染和音效通过稳定 ID 连接，减少题材硬编码。
5. **注入 Game Pack**：状态、主循环、渲染和输入接收内容包，不再直接依赖单例题材配置。
6. **补事件层**：先定义并本地记录完整事件，再接服务端或第三方分析平台。
7. **制作第二版本**：保持规则集不变，只换原创题材、英雄、文案、美术、音乐和关卡数据。
8. **制作关卡变体**：保持题材不变，新增地图、特殊目标或 Boss 阶段，验证关卡语法。
9. **建立 Beta 闭环**：补构建、预发、监控、灰度、回滚、反馈和数据看板。
10. **数据验证后商业化**：确认完成、重试和回流信号后，再建设皮肤、会员、广告和支付。

## 9. 第二版本验收门槛

- 新题材主要新增或修改 `games/<game-id>/`，不复制整套引擎。
- 新增角色、敌人、地图和关卡不修改 `engine-core`。
- 新增技能优先通过注册表组合；确属新机制时才扩展 `ruleset`。
- 玩家可见文案、素材路径、主题色和音频事件不散落回核心源码。
- 所有 Manifest 通过 Schema、引用、资源和版本校验。
- 现有逻辑测试保持通过，并为第二内容包生成独立测试与截图基线。
- 关键玩家事件可观察，失败原因可区分，版本字段完整。
- 有可复现的构建产物、版本号、预发验证和回滚方法。
- 第二版本暴露出的差异先记录；未被两个版本共同验证的能力不强行抽象。

## 10. 当前明确不做

- 不一次性重写整个项目。
- 不建设覆盖所有游戏类型的万能 ECS、编辑器或低代码平台。
- 不为“看起来通用”而把所有数值和逻辑都塞进 JSON。
- 不把完整 AI 生成 UI 图直接当作可交互界面。
- 不用视觉上的排行榜、背包、会员入口冒充真实系统。
- 不在缺少账号、权益、订单校验和数据验证时优先开发会员、皮肤或支付。
- 不把高相似参考直接视为可商用资产；发布前必须完成权利台账与审查。

## 11. 交给另一个窗口的第一条指令

```text
请先完整阅读 docs/ai-game-production-keywords.md，并只读核对当前仓库。然后输出《AI 游戏生产基座 V1 设计方案》，暂不修改代码。方案必须包含：现有文件到 engine-core/ruleset/content-pack/presentation-pack/platform-services 的映射；第一轮最小改动范围；Manifest 与 Schema 草案；技能/效果注册表接口；埋点事件协议；迁移顺序；兼容现有存档和测试的方法；风险、非目标、分阶段验收标准。所有结论请附文件:行号证据，并明确哪些能力留到第二内容包验证后再抽象。
```

## 12. 第一阶段实际落点（2026-07-20）

- `games/zhaoyun-adou/` 已成为首个可校验 Game Pack，包含八个 JSON Manifest、八个 Schema 和浏览器同步模块。
- `src/config.js` 只保留默认 Pack 的兼容视图；原有数值、五关、地图、存档键和调用方式不变。
- 状态工厂、控制器、规则推进、输入和渲染入口支持末尾注入 `gamePack`；运行时依赖通过 `WeakMap` 关联，不进入可序列化状态。
- 技能 handler、道具 behavior、效果生命周期、效果 renderer、英雄表现和音频 Cue 已使用稳定 ID 注册。
- 本地事件 reporter/collector 已覆盖本章定义的 16 个事件，自动补齐三个版本、结果、失败原因和有限状态快照；平台端口尚未连接第三方。
- `scripts/validate-game-pack.mjs` 在零第三方依赖下校验 Schema、版本、跨 Manifest 引用、地图语义和真实素材文件。

仍保留在 JavaScript 的内容是有意边界：路径插值、波次状态机、索敌与伤害、五种技能机制、Canvas 几何绘制和 WebAudio 适配。第二内容包出现新差异之前，不继续抽象成万能 DSL、ECS 或编辑器。

## 13. 基座 V2：多平台运行与长期维护（规划）

> 本节的 V2 指生产基座第二阶段，不等于“第二个题材内容包”。V1 解决内容、规则和表现如何替换；V2 解决同一套游戏如何在 Web、微信小游戏、iOS、Android 及后续宿主中稳定运行、独立发布和长期维护。

V2 的目标不是“一份产物到处运行”，而是：

> **一套玩法与内容源码 + 一份版本化能力契约 + 多个薄平台适配器 + 多份可独立验证、发布、观测和回滚的目标产物。**

### 13.1 当前证据与 V2 缺口

| 证据 | 推导 | V2 结论 |
| --- | --- | --- |
| `src/platform-services/ports.js:13-18` 目前只列出 analytics、storage、assets、audio 四个端口名称 | 已有平台边界意识，但还没有方法契约、能力声明和一致性测试 | 补完整 Host 契约与 adapter contract tests |
| `src/main.js:21-60,167-220` 直接访问 `document`、`window`、计时器、生命周期和调试句柄 | 当前装配入口仍是浏览器入口，不是平台无关应用入口 | 提炼 `createGameApp({ gamePack, host, services })` |
| `src/input.js:19-25,353-361` 同时处理坐标、玩法命令和 DOM 事件绑定 | 输入协议和宿主监听器耦合，切换平台时容易复制玩法逻辑 | 拆成“平台事件 → 标准输入 → Game Command → 玩法处理” |
| `src/render-theme.js:134` 创建 DOM Canvas；`src/engine-core/assets.js:11-21` 依赖 `URL/Image/addEventListener` | `engine-core` 和表现层还不能直接在小游戏宿主运行 | Canvas、离屏 Canvas、图片工厂和路径解析由 Host 提供 |
| `src/audio.js:11-19`、`src/storage.js:73-75` 仍是浏览器实现 | 音频和本地存储尚未通过真实平台适配器注入 | Web、微信和移动容器分别实现同一契约 |
| `games/zhaoyun-adou/game.json:15` 只声明 `web`，`package.json:5-10` 没有平台构建目标 | Game Pack 已建立，但目标产物和发布矩阵尚未建立 | 只有真实构建并通过验收的平台才能写入 `targetPlatforms` |
| `test/boundary-test.mjs:10-25` 主要防止题材反向依赖 | V1 边界测试还不能阻止平台全局重新进入核心 | 增加平台全局静态门禁和共享适配器契约测试 |

最重要的结构性判断：**V1 已解决“换内容”，V2 不再继续抽象玩法；V2 优先解决“换宿主、升版本、发多端、出问题后能定位和回退”。**

### 13.2 目标逻辑架构

```text
games/* + presentation-pack/*
              ↓
engine-core + rulesets
              ↓
app-shell / createGameApp
              ↓
platform-contracts
              ↓
platforms/web | platforms/wechat | platforms/mobile
                                      ├── ios bridge/config
                                      └── android bridge/config
              ↓
service-clients → common backend/BFF

targets/web | targets/wechat | targets/ios | targets/android
              ↓
独立构建、测试、签名、发布、观测和回滚
```

逻辑职责：

- `engine-core + rulesets`：纯 JavaScript、确定性玩法，不识别 Web、微信、iOS 或 Android。
- `app-shell`：统一装配 Game Pack、状态、主循环、命令、渲染、事件和生命周期。
- `platform-contracts`：描述宿主必须提供什么能力，不包含任何具体 SDK。
- `platforms/<id>`：平台组合根和真实 Adapter；平台全局只能出现在这里。
- `service-clients`：账号、云存档、远程配置、分析和商业化等远程能力，与本地 Canvas/输入/音频适配分开。
- `targets/<id>`：平台入口、构建配置、素材策略、权限、签名和发布元数据。

这仍是逻辑边界，不要求一次性移动全部目录。Canvas2D 绘制协议继续共享，不包装每一个 `ctx` 方法；只有真实数据证明 WebView/小游戏 Canvas 无法满足性能时，才评估独立原生 renderer。

### 13.3 Host 能力契约

平台 Host 的首版必选能力：

| 能力 | 责任 | 关键约束 |
| --- | --- | --- |
| `Surface` | 主 Canvas、离屏 Canvas、图片工厂、视口、DPR、安全区 | 不允许表现层自行访问 DOM 或平台全局 |
| `Scheduler` | 单调时钟、逻辑循环、渲染帧、取消任务 | 后台恢复不能补算巨量时间；销毁后不得继续运行 |
| `Lifecycle` | 前台、后台、中断、恢复和退出 | 所有订阅返回取消函数 |
| `InputSource` | 鼠标、触控、键盘或平台事件归一化 | 只输出标准坐标和动作，不直接修改玩法状态 |
| `KeyValueStorage` | 读、写、删、持久性状态和错误降级 | 保持现有存档键兼容；失败不得让游戏崩溃 |
| `AssetLoader` | 路径解析、图片加载、失败状态和缓存 | Game Pack 只引用稳定素材 ID |
| `AudioAdapter` | 初始化、播放、暂停、恢复、音量和销毁 | 允许无声降级，但必须报告能力和失败原因 |
| `DeviceInfo` | 平台、语言、视口、安全区和性能档位 | 对核心输出规范化字段，不暴露 SDK 对象 |

可选能力按真实产品需要增加：`Network`、`Identity`、`CloudSave`、`RemoteConfig`、`Telemetry`、`CrashReporter`、`Share`、`Haptics`、`Leaderboard`、`Ads`、`Commerce`。

每个 Host 声明 `adapterApiVersion` 和能力状态：`supported`、`degraded`、`unsupported`。应用只查询能力，不在玩法或内容文件中散落 `if (platform === 'wechat')`、`typeof wx` 或 User-Agent 判断。

`createGameApp` 至少提供：

- `start()`：装载资源、创建会话并启动循环。
- `pause()` / `resume()`：映射宿主生命周期并重置时钟。
- `destroy()`：注销监听器、停止循环、释放音频和调试句柄。
- `getStateSnapshot()`：为自动测试、故障诊断和确定性回放提供受控快照。

### 13.4 平台目标策略

| 目标 | 复用方式 | 需要单独维护的内容 |
| --- | --- | --- |
| Web | 当前 H5 迁入 `platforms/web` | DOM、Pointer/Touch/Keyboard、WebAudio、localStorage、无障碍和 Web 发布 |
| 微信小游戏 | 共享 Game Pack、ruleset 和 Canvas2D 绘制 | 小游戏入口、Canvas/图片、触控、存储、音频、前后台、包体和审核 |
| iOS/Android 混合容器 | 首选共享一个 `platforms/mobile` WebView Host | 两端签名、权限、安全区、系统返回键、原生桥、商店支付和审核分别配置 |
| 后续平台 | 实现相同 Host 契约和 target profile | 仅新增平台 Adapter、构建配置与验收，不复制玩法源码 |

iOS/Android 不在 V2 开始时直接原生重写。先用真实渠道需求、帧率、内存、启动时间和包体数据决定：

1. WebView 达标：继续共享 Canvas2D 与 mobile Host。
2. 只有个别能力不足：增加小型原生桥，不重写玩法。
3. 持续性能不达标且有明确商业价值：新建原生表现运行时，规则、内容、事件和存档协议仍复用。

### 13.5 版本、存档与协议兼容

在现有 `gameVersion`、`rulesetVersion`、`contentVersion`、`presentationVersion` 基础上，按子系统实际落地顺序增加：

- `engineApiVersion`：核心与 app-shell 契约。
- `adapterApiVersion`：Host 与平台 Adapter 契约。
- `saveSchemaVersion`：本地/云存档结构。
- `eventSchemaVersion`：事件名称和字段语义。
- `backendApiVersion`：远程服务协议。
- `buildNumber`：各商店或平台单调递增的构建号。
- `releaseId`：聚合代码提交、Game Pack、Adapter 和构建产物的一次发布标识。

兼容规则：

- 构建时与启动时校验允许的版本范围；不兼容时明确拒绝并给出原因，不能带病运行。
- 存档改为带版本的 envelope，至少包含 `gameId`、`saveSchemaVersion`、`contentVersion`、`revision`、`updatedAt`、`payload` 和校验信息。
- 继续读取现有标量/旧键；迁移函数必须逐版本、幂等、有 fixture，迁移前保留原副本。
- 未来云存档使用 revision/ETag 等显式并发控制；冲突规则必须可解释，不能默认“最后写入覆盖一切”。
- 事件字段优先向后兼容地增加；语义变化时提升事件版本，并统一附加 `releaseId`、平台、构建号、Adapter 版本和用户同意状态。
- 应用商店版本无法即时回滚时，依靠兼容后端、远程关闭开关和上一份兼容内容包止损；远程配置不得下发可执行代码绕过审核。

### 13.6 构建、发布与可观测性

同一次源码提交按目标生成独立产物：

```text
dist/web/
dist/wechat/
dist/mobile/ios/
dist/mobile/android/
```

每个产物生成 `release-manifest.json`，记录：Git 提交、`releaseId`、各子系统版本、目标平台、渠道、构建时间、文件哈希、素材清单和包体明细。发布与回滚以不可变产物为单位，不能手工复制源码后分别修改。

计划中的流水线顺序：

1. Game Pack、Schema、引用和版本校验。
2. 共享规则、事件、存档迁移和边界测试。
3. 各 Adapter 的同一套契约测试。
4. `build:<target>` 构建、按引用裁剪素材并生成包体报告。
5. 对最终产物运行启动、输入、音频、存档和生命周期 smoke test。
6. 权限、隐私、许可、密钥泄漏和远程配置白名单检查。
7. 预发、灰度、暂停、回滚或商店上传。

统一观测三类信号：

- 业务事件：开始、操作、失败、通关、重试、退出和回流。
- 技术指标：冷启动、首帧、FPS/卡顿、内存压力、素材/音频/存档/网络失败。
- 异常信号：JS 异常、未处理拒绝、平台 SDK 错误和崩溃。

所有信号至少带 `releaseId`、平台、构建号、Game/Ruleset/Content/Presentation/Adapter/Event Schema 版本。阈值先从真实基线产生，不预设万能数字；但每个平台必须有发布看板、异常定位、停止灰度、关闭功能或回退内容的路径。

### 13.7 远程服务的扩展边界

先采用模块化单体/BFF，不把微服务、Kubernetes 或多供应商系统作为前置条件。

推荐按真实需求依次建设：

1. `Telemetry + CrashReporter`：先看见真实错误和体验问题。
2. `Identity + CloudSave`：需要跨设备进度时再接入；平台票据由后端兑换。
3. `RemoteConfig`：只允许审核过的数值与功能开关，保留默认本地配置。
4. `Leaderboard`：成绩必须服务端校验。
5. `Commerce / Ads`：账号、订单验签、幂等、退款和权益恢复完备后再接。

共同约束：

- 单机核心保持离线可玩；服务故障不得打断战斗。
- 网络请求有超时、有限重试、幂等 key 和有上限的离线 outbox。
- 客户端不保存服务端密钥；token、支付凭证与普通进度分离。
- 订单、权益和排行榜结果以服务端为准；客户端校验只能发现损坏，不能充当反作弊。
- 数据采集遵循最小字段、明确用途、保留期、删除机制和用户同意状态。
- 第三方 SDK 通过 provider adapter 接入，记录版本、权限、替换方案和退役日期。

### 13.8 跨平台测试矩阵

- **共享逻辑**：同一套规则、Game Pack、Schema、事件和存档迁移测试只跑共享实现，不为每个平台复制一份。
- **边界门禁**：`engine-core`、`ruleset` 和内容包禁止出现 `window`、`document`、`localStorage`、`AudioContext`、`wx` 或原生桥。
- **Adapter 契约**：同一测试验证正常、能力缺失、异常、取消订阅和重复销毁。
- **确定性回放**：玩法随机与表现随机分流并可注入；相同 seed 与动作序列得到相同关键状态摘要。
- **生命周期**：连续装载/销毁三次无重复输入、重复循环、残留音频或监听器。
- **存档**：覆盖旧版迁移、损坏数据、未来版本拒绝、持久层失败和云端冲突。
- **平台 smoke**：统一执行启动、进入第一关、征兵、部署、暂停、后台、恢复、结算、重开和重新进入后的进度恢复。
- **异常环境**：断网、慢网、存储满、音频中断、低内存、安全区、DPR 和前后台频繁切换。
- **最终产物**：发布测试针对 `dist/<target>`，不能只验证源码开发服务器。

设备门槛按阶段增加：Web 浏览器矩阵；微信开发者工具 + 至少一台 iOS 和一台 Android 微信真机；移动容器再覆盖 iOS/Android 的低端与主流设备。性能和包体先建立真实基线，再把预算写入构建门禁。

### 13.9 分阶段执行门槛

| 阶段 | 本阶段只做什么 | 进入下一阶段的门槛 |
| --- | --- | --- |
| V2.0 技术探针 | 用最薄微信实验验证 Canvas、离屏 Canvas、图片、触控、音频、存储和前后台 | 开发者工具完成“启动 → 进入第一关 → 操作 → 后台 → 恢复”，形成真实能力差异表；探针不进入正式架构 |
| V2.1 Web Host 抽离 | 建立 `createGameApp`、完整 Host 契约和 Web Adapter，保持当前玩法与视觉 | 既有测试和截图通过；非平台目录无浏览器全局；连续装载/销毁三次无泄漏 |
| V2.2 微信小游戏适配 | 新增微信 Host、入口、配置、构建和素材裁剪 | 开发者工具及 iOS/Android 微信真机完成主流程；存储、音频、前后台、安全区和包体报告通过 |
| V2.3 维护闭环 | 增加存档迁移、构建指纹、Adapter CI、发布记录、错误与性能观测 | 旧存档可升级；坏存档可降级；每个产物可追溯；Web/微信均有复验与回滚记录 |
| V2.4 App 路线决策 | 根据渠道和性能数据选择 WebView 壳、小型原生桥或原生 renderer | 没有明确渠道需求或性能不达标证据时，不创建空的 iOS/Android 原生层 |
| V2.5 移动端与在线服务 | 建共享 mobile Host，再分别完成 iOS/Android 构建；按需求接最小 BFF | 两端真机闭环、商店合规、服务故障降级和发布观测通过后，才考虑商业化能力 |

每一阶段独立验收、可停止、可回退；不要同时重写核心、接四个平台和建设后端。

### 13.10 V2 验收标准

- Web、微信和移动端使用同一份 Game Pack、规则与玩法源码，不复制核心目录。
- 平台全局只存在于 `platforms/<id>` 和平台测试工具中。
- `createGameApp` 可启动、暂停、恢复、销毁；销毁后无监听器、定时器和音频泄漏。
- 每个 Adapter 通过同一契约测试；可选能力缺失时有明确降级行为。
- 现有 Web 玩法、五关结果、截图和旧存档保持兼容。
- 微信及后续目标通过统一主流程真机 smoke，而不是只在模拟器或源码服务器中通过。
- 相同 seed 和动作序列在不同 Host 中得到同一关键玩法状态摘要。
- 每个平台只打包 Manifest 实际引用的素材，超出配置预算时构建失败。
- 每个发布产物可追溯到代码、Game Pack、Adapter、版本和文件哈希。
- 存档迁移失败保留原副本；埋点、网络或远程服务故障不影响离线游玩。
- 新增第五个平台时，主要新增 Adapter、capability profile、target 配置和平台测试；新增通用端口必须有两个真实平台证据和 ADR。

### 13.11 V2 明确不做

- 不维护 Web、微信、iOS、Android 四套玩法或内容代码。
- 不建设万能图形 API、ECS、依赖注入容器、可视化编辑器或插件市场。
- 不追求所有平台能力完全一致；可选能力允许关闭或降级。
- 不在缺少真实路线与性能证据时进行 iOS/Android 原生游戏重写。
- 不为尚无产品需求的账号、广告、支付或排行榜预建空系统。
- 不把平台构建参数、商店密钥、审核材料或 SDK 对象写进 Game Pack。
- 不使用一个巨大的 `if (platform)` 文件处理所有平台。
- 不允许远程下发可执行代码绕过平台审核。
- 不把客户端 checksum、混淆或本地校验当成安全、验权或反作弊。

### 13.12 交给执行窗口的 V2.0–V2.1 指令

```text
请先确认“AI 游戏生产基座第一阶段”已经完成、全量测试通过且工作区差异审查完毕，然后完整阅读 docs/ai-game-production-keywords.md 第 13 节。

本轮只执行 V2.0–V2.1：先用隔离技术探针验证微信小游戏的 Canvas、离屏 Canvas、图片、触控、音频、存储和前后台能力；根据真实结果定义最小 Host 契约。随后提炼 createGameApp({ gamePack, host, services })，实现 Web Host，把 main/input/storage/audio/assets/lifecycle 中的浏览器依赖迁入 platforms/web，并补 Adapter 契约、平台全局边界、重复装载销毁和旧存档兼容测试。

保持现有五关结果、视觉、操作、localStorage 键和浏览器测试兼容；不实现正式微信发布、不创建 iOS/Android 空适配器、不建设后端、不接账号/支付/广告、不重写 Canvas2D renderer。完成后运行全量测试和截图复验，并用“证据 → 推导 → 结论”报告尚未抽离的平台依赖、探针结果和进入 V2.2 的门槛。
```

### 13.13 V2.0–V2.1 实际落点（2026-07-20）

本轮在 V1 Game Pack 边界之上增加宿主边界，没有改动玩法协议、五关数值、Canvas2D
视觉或旧存档格式：

- `src/platform-contracts/host.js` 定义 `adapterApiVersion = 1.0.0`，约束 `Surface`、
  `Scheduler`、`Lifecycle`、`InputSource`、`KeyValueStorage`、`AssetLoader`、
  `AudioAdapter` 和 `DeviceInfo`。必选能力状态只有 `supported`、`degraded`、
  `unsupported`。
- `src/app-shell/create-game-app.js` 负责 Game Pack、状态工厂、控制器、规则循环、输入、
  音频、存储、事件、状态输出与生命周期的统一装配，并提供 `start/pause/resume/destroy/
  getStateSnapshot/getCommandLogSnapshot`。销毁为幂等操作；命令日志是有上限的运行时诊断数据，
  不进入玩法状态或旧存档。
- `src/platforms/web/` 接管 DOM Canvas、离屏 Canvas、图片、Pointer/Touch/Keyboard、
  resize/DPR/视口、localStorage、WebAudio、visibility/pagehide、RAF/interval、dataset、
  ARIA、隐藏状态输出与调试句柄。
- `src/input.js` 装配 `LocalPlayerController`，把标准输入解释成带 actor、side、sequence、
  tick、time 和纯数据 payload 的语义 `GameCommand`，再交给 merge-defense dispatcher；
  后续微信 Host 不复制标题页、征兵、拖拽、部署、交换、合成、铲地或毛笔玩法分支。
- `src/engine-core/random.js` 提供互不消耗的 gameplay/presentation 随机流；相同 seed 和
  招募动作得到相同关键状态摘要，粒子与抖动不改变抽取序列。
- 正常运行仍原样读取 `zyad_cleared_stars` 与 `zyad_best`；`?e2e=` 的现有测试隔离命名
  保持不变。`games/zhaoyun-adou/game.json` 的 `targetPlatforms` 仍只有 `web`。

#### Host 1.0.0 能力矩阵

| 能力 | Web Host | 微信 V2.0 探针 | 正式约束 |
| --- | --- | --- | --- |
| Surface / 主 Canvas | supported | 官方 `wx.createCanvas`；未运行 | 微信 Adapter 必须独占第一次创建顺序 |
| 离屏 Canvas | supported | 后续 `wx.createCanvas`；未运行 | 不依赖没有有效小游戏文档页的专用 API |
| Image / AssetLoader | supported；缺 Image 时 degraded | 官方 `wx.createImage`；未运行 | 缓存、失败状态和销毁统一 |
| Pointer / Touch | Pointer 优先，旧 WebView 回退 Touch+Mouse | 官方 Touch API；未运行 | 统一为逻辑坐标事件，监听可注销 |
| Keyboard | supported | 文本输入不等于 keydown | 微信声明 degraded 或 unsupported |
| Storage | localStorage 可用时 supported，否则 degraded | 官方同步存储；未运行 | 失败转会话内存影子，旧键不变 |
| Audio | WebAudio 可用时 supported，否则 unsupported | 官方 InnerAudioContext；未确认可听 | 允许无声降级，销毁实例 |
| Lifecycle | visibility/pagehide supported | 官方 onShow/onHide；未运行 | 后台冻结，恢复重置时钟 |
| Scheduler | performance/RAF/interval supported | 官方 RAF；Performance.now 为微秒 | Host 对核心统一输出单调毫秒 |
| DeviceInfo / 安全区 | 视口、DPR、CSS 安全区 supported | 官方 getWindowInfo；未运行 | 缺 safeArea 时降级为完整窗口 |

V2.0 的真实结论仅为：微信官方能力已经核对，隔离探针源码与语法验证完成，本机没有微信
开发者工具或可用 CLI，因而没有模拟器、账号、iOS/Android 真机、可听音频及后台恢复证据。
完整记录见 `docs/wechat-minigame-capability-probe.md`，不能把静态扫描或 Web 结果表述成微信
真机成功。

#### 仍未抽离的平台差异

- `index.html`、页面 CSS 和 `src/main.js` 是 Web 目标入口；这是目标装配层，不属于共享玩法。
- 共享 renderer 仍直接使用 Canvas2D 方法。这是本阶段刻意保留的表现协议，必须由 V2.2
  探针验证微信 Canvas2D 兼容性，而不是先建设万能图形 API。
- `render-theme.js` 保留 `import.meta.url` 作为无 Host 测试时的素材基准回退；正式微信包必须
  由 WeChat AssetLoader 提供包内路径解析。
- 事件 reporter 的默认 session ID 仍可使用通用 `crypto.randomUUID` 回退；平台发布标识和
  可复现会话 ID 应在 V2.2/V2.3 由 target services 显式注入。

进入 V2.2 前必须补齐：安装并记录微信开发者工具版本；在开发者工具执行探针全状态机；用
真实小游戏账号完成预览；至少一台 iOS 和一台 Android 微信真机验证主/离屏 Canvas、图片、
触摸、可听音频、存储、视口/安全区、前后台和恢复；据结果实现 `platforms/wechat`、小游戏
入口与目标配置；加入共享 Host contract tests、目标构建/包体报告和真机截图。以上完成并
验收前，不把 `wechat` 写入 `targetPlatforms`。

## 14. 玩法演进路线 G1–G4（独立于平台基座 V2）

`G` 是玩法和对局形态版本线，`V2` 是 Host 与平台运行版本线。两者可各自推进，但不能用
“已完成 Web/微信 Host”推导“已具备对阵”，也不能为了未来对阵把平台判断写进规则文件。

### 14.1 当前协议落点与边界

- `StandardInput → LocalPlayerController → GameCommand → merge-defense dispatcher` 是当前唯一
  玩家状态修改链。自动出怪、单位攻击、英雄自动施法和洛阳铲被动产出属于规则时钟，不伪装
  成 Controller 命令。
- `GameCommand API 1.0.0` 字段为 `apiVersion/type/actorId/side/sequence/tick/time/payload`。
  payload 只允许 JSON 纯数据；单位位置统一为 `{zone:'bench',index}` 或
  `{zone:'grid',r,c}`，不得包含 DOM、Canvas、Host、SDK 或单位对象引用。
- 本地命令日志默认最多 256 条，FIFO 丢弃并记录 `dropped`；每条记录命令、结果、执行前
  hash 和执行后关键状态 hash。它只用于诊断与确定性断言，不写入 `state`、localStorage 或
  Game Pack，也不是安全或反作弊证明。
- `Controller API 1.0.0` 当前只有一个真实实现 `LocalPlayerController`，职责是订阅标准输入、
  解释 UI 命中、补齐命令元数据、提交和注销。ScriptedBot、Replay、Remote 只在后续阶段按
  真实需求实现，本轮不创建空类或伪联网文件。
- 现有固定双路线塔防记为 `MatchMode = campaign-route-defense`；未来上、下阵营对位记为
  `MatchMode = mirrored-lane-duel`。二者共享 GameCommand 信封和可复用规则原语，但各自拥有
  对局状态机与胜负规则，禁止在一个规则文件中堆叠大量 `if (mode)`。

当前语义命令覆盖：选关、开局、进度重置、批量征兵、开波、暂停、速度、拖拽开始/取消、
单位落点（结果为 move/swap/merge）、道具选择/使用、结算、重试和退出。核心玩法不判断
`local/bot/remote`，只验证命令内容、顺序和规则状态。

### 14.2 G1 单机战役完善（本轮实际落点）

进入条件：V1 Game Pack 与 V2.1 Web Host 已全量通过；五关、旧存档、平台边界和重复销毁
有基线证据。

本轮范围：

1. `troop/frag` 任意等级都可在合法位置移动；营栏内不合成，棋盘目标可合成时优先合成，
   否则对另一个可移动单位执行原子交换。
2. 起拖只保留源位置，不先删除单位；落点重新验证 source、target 和 expectedSource，全部通过
   后才一次提交。失败返回稳定 reason、原状态不变并产生 `invalid_action`。
3. 一次 `battle.batch_recruit` 按现有费用曲线与抽取规则逐格填充；每一抽独立扣费并产生
   `recruit_attempt/recruit_result`，资源不足可部分成功，营满零扣费且不覆盖候选。
4. 路线表现直接读取关卡展开后的 `state.paths`，显示入口、连续虚线、行进箭头、转折与营门
   终点；开放格、路线、封地以及移动/合成/交换/无效目标分别采用不同层级与颜色。
5. 保持 `campaign-route-defense` 的五关数值、敌人路径、英雄、旧存档键、Web Host 和平台契约
   不变。

退出条件与测试门槛：交换无丢失/复制、非法目标完全回滚、合成后可移动；批量全填/部分成功/
营满零扣费与逐次事件通过；同 seed + 同初态 + 同命令序列得到相同结果和关键状态 hash；五关、
旧存档、Host 三次销毁、Chrome 真实输入和源码指纹对应截图全部通过。

2026-07-20 实际验收：`npm test` 全量通过；Chrome 未使用 `__step` 或测试状态
篡改，仅通过公开的 2 倍速按钮完成五关、五英雄技能、Boss、战败与重试；
25 张关键截图的源码指纹为
`fc08aeafbc37cb507888c58a4e5197a132e71088868a90b6a81dd0e0296ad902`，清单位于
`test-artifacts/screenshots/2026-07-20/manifest.json`。

数据指标：`invalid_action.reason` 分布、每批填充数/总花费/停止原因、move/swap/merge 次数、
关卡开始到首波耗时、五关胜率/重试/退出。G1 只建立本地可测试事件与数据字段，不接服务商。

明确非目标：上方机器人阵营、对位 UI、账号、云存档、匹配、房间、网络同步和商业化。

### 14.3 G2 单机机器人对位

进入条件：G1 五关和操作数据稳定；确定 `mirrored-lane-duel` 的最小地图、经济、出兵/部署、
胜负和回合/时钟规则；为玩法随机建立可保存 seed/游标或从起点完整重放方案；固定步长或等价的
确定性时钟测试通过。

本阶段只做：下方 `LocalPlayerController`、上方可复现的 `ScriptedBotController`，双方通过同一
GameCommand/dispatcher 驱动第二个真实 MatchMode。机器人使用有限状态/脚本和可注入 seed，
不接大模型，不读取 Canvas 像素，不拥有绕过规则的私有状态修改入口。

退出条件与测试门槛：至少两套真实 Controller 在同一规则下完成完整对局；相同 seed、脚本、
tick 和命令序列结果一致；机器人可被暂停、销毁和复跑；无平台或控制来源分支进入玩法；战役
模式无回归。只有到此时才根据两个真实实现提炼下一层 Controller 公共能力，不能提前建设万能
战斗协议。

数据指标：单局时长、玩家胜率、投降/退出率、机器人决策耗时、命令拒绝率、重复 seed 差异。

明确非目标：玩家匹配、远程房间、服务端裁决、异步挑战、实时同步、LLM Agent 和行为树编辑器。

### 14.4 G3 异步玩家对阵

进入条件：G2 对位模式留存和重复游玩数据证明有需求；账号/玩家标识、隐私、内容版本冻结、
服务端存储、阵容或指令记录校验、回放兼容和滥用治理有独立设计并通过安全评审。

候选形态按风险从低到高选择一种：挑战对手保存的阵容；挑战固定 seed 下的服务端校验阵容；
挑战经服务端验证的有限命令记录。异步挑战不是实时房间，不要求双方同时在线。客户端提交只能
作为输入，奖励和结果必须由服务端验证。

退出条件与测试门槛：跨版本挑战有明确兼容/拒绝策略；重复提交幂等；篡改阵容、seed、命令和
奖励会被拒绝；离线/超时可恢复；旧战役与本地对局仍可离线玩。

数据指标：发起率、完成率、复仇/再挑战率、校验失败率、延迟、存储成本、举报与异常奖励率。

明确非目标：实时匹配、WebSocket、帧同步、实时状态同步和断线接管；支付、广告、会员仍不是
异步玩法的前置能力。

### 14.5 G4 实时 PvP（数据门槛后置）

进入条件：G3 的真实渠道、留存、对战频次和付费无关的参与数据证明实时互动有显著增量；团队
具备服务端权威裁决、匹配/房间、区域部署、容量、值班、成本、安全与合规预算。没有这些证据
就停留在 G2/G3。

本阶段才建设：匹配、房间、服务端裁决、状态/输入同步、延迟与抖动处理、断线恢复、版本协商、
观战/回放、反作弊、申诉和运营止损。客户端仍通过 GameCommand 提交意图，不能成为权威结果源。

退出条件与测试门槛：目标网络条件下的延迟/丢包/重连矩阵；确定性与服务端裁决一致；灰度、
扩容、降级、停服和回滚演练；作弊/重放/篡改/超频命令测试；跨版本房间明确拒绝或兼容。

数据指标：匹配时长、首局成功率、有效对局率、P50/P95 延迟、掉线/重连率、作弊命中与误伤率、
服务器单局成本、实时相对异步的留存增量。

明确非目标：在 G4 立项前创建 WebSocket 空壳、复制一套“联网玩法”、客户端权威帧同步、万能
ECS/网络引擎或以 LLM 代替确定性 Controller。

### 14.6 进入下一内容包或对阵模式前仍需完成

- 为单位是否需要稳定 entity ID 做第二真实 MatchMode 证据评估；G1 仅用位置、sequence 和
  expectedSource，不能宣称已解决服务端实体身份。
- 明确固定步长与随机游标/快照方案；当前 G1 只保证相同显式时间推进和完整 seed 起点的回放，
  不保证不同设备实时调度自然得到逐帧一致状态。
- 把 command log header 补齐 releaseId、初始阶段、seed 与目标 MatchMode，并设计版本不兼容时
  的明确拒绝；在需要 ReplayController 前不把日志写入旧存档。
- 用第二个真实 MatchMode 验证哪些放置、经济、波次和胜负规则可以复用；没有两份真实证据前，
  不继续抽象万能战斗层。
