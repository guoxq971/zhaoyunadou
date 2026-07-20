# 《赵云与阿斗》视觉、质量与自动化扩展规格

## 背景与范围

本轮承接已完成的“军士一·五星”可玩版本，继续推进已列出的 U（未测项）与 P（优化项）。
用户已明确授权自动测试、素材生成和 Chrome 实测，因此不再为已确认方向逐项停下来询问。

当前工作区包含上一轮尚未提交的同需求改动。本轮继续在该工作区增量开发，避免从旧 HEAD 建 worktree 后丢失战役实现。

### 本轮目标

1. 为存档异常、资源边界、结果控制链和第五关重玩补可重复自动化测试。
2. 将关键流程从页面装配中拆成可测试模块，保持每个文件小于 500 行。
3. 使用新生成的巨鹿水墨战场素材提升棋盘、敌人、营栏和结算层级。
4. 用 Chrome 验证标题、布阵、战斗、失败/胜利与五星恢复，并把关键截图保存到项目目录。
5. 保持核心操作、五关存档以及桌面/移动布局兼容。

### 本轮不宣称完成

- 原作完整双边 AI 战场、武器背包、排行榜与账号云存档仍属于后续产品功能。
- iOS/Android 真机、Safari/Firefox/Edge 兼容性需要对应设备或浏览器环境，不能用当前 Chrome 冒充。
- 英雄自然随机抽齐的长流程会先补确定性自动化和代表性 Chrome 验证，不把夹具测试说成自然概率实测。

## 前端视觉工作模型

- **Visual thesis**：在一张有纵深的巨鹿宣纸战场上作战；信息像军令牌，棋盘像铺在土路上的阵图，朱砂只用于行动和危险，金色只用于成就和英雄。
- **Content plan**：标题页负责人物与品牌；战斗页上部负责方向与资源，中部只负责棋盘态势，下部只负责营栏与三项操作；结算页负责输赢和下一步。
- **Interaction thesis**：标题图轻微入场；可落格与可合成格做节制呼吸；按钮按压和波次/危险提示用短促朱砂反馈，避免持续闪烁。

## UI Inventory

| id | level | type_guess | position | visible_text | interaction | children | confidence | notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `R1` | page | title-scene | full canvas | 赵云与阿斗、军士一、星级、开始游戏 | 进入当前已解锁关 | `R1-A1,R1-A2` | 0.98 | 参考图强调水墨人物与朱砂标题 |
| `R1-A1` | control | stage-progress | lower-middle | 第 N 关 / 共 5 关、五星 | 只读进度 | - | 0.96 | 使用金色，不和主按钮争抢 |
| `R1-A2` | control | primary-seal-button | bottom | 开始游戏 | 开始/重玩最高已解锁关 | - | 0.99 | 朱砂印章式按钮 |
| `R2` | section | battle-status | top | 巨鹿、关卡、波次、命、馒头、歼敌 | 读取战局 | `R2-A1` | 0.99 | 参考图中暂停、生命与波次同层 |
| `R2-A1` | control | wave-call-banner | top-center | 整军待发 / 第 N 波来袭 | 主动开战 | - | 0.98 | 必须有清晰可点击态 |
| `R3` | section | tactical-board | center | 字牌、道路、苔地、阿斗、敌人 | 拖放、合成、铲地 | `R3-C1,R3-C2` | 0.99 | 全局视觉锚点，素材不得降低格线可读性 |
| `R3-C1` | control | tile-card | grid | 刀、枪、弓、骑、农、英雄字 | 拖放/合成 | - | 0.99 | 参考图为宣纸字牌与手写字 |
| `R3-C2` | display | enemy-token | path | 贼、飞、巨、悍、魁 | 沿路移动、承伤 | - | 0.97 | 用轮廓、印色和体量区分，不只换文字 |
| `R4` | section | camp-bench | lower | 营、五个槽位 | 收纳和起拖 | - | 0.99 | 参考图为屋檐式营地入口 |
| `R5` | section | battle-actions | bottom | 铲、征兵、倍速/暂停 | 操作资源与节奏 | `R5-A1,R5-A2,R5-A3` | 0.99 | 三项主操作，避免额外按钮噪声 |
| `R6` | overlay | result-scene | modal/full canvas | 大捷/败北、星级、下一关/凯旋/重试 | 结算跳转 | - | 0.99 | 深墨遮罩 + 宣纸军报，不使用通用白卡片 |

## Wireframe Sketch

```text
┌──────────────────────────────────┐
│ R2  命/馒头   巨鹿·军士一   歼敌 │
│              第N关·N/目标波      │
│ R2-A1  整军待发 / 下一波倒计时   │
├──────────────────────────────────┤
│                                  │
│ R3  9×10 战术棋盘（主视觉）       │
│     字牌 / 苔地 / 土路 / 敌人     │
│                                  │
├──────────────────────────────────┤
│ R4  营  [牌][牌][牌][ ][ ]        │
│ R5 [铲]   [     征兵     ] [倍速] │
│       英雄战意 / 状态（有时出现） │
└──────────────────────────────────┘

结果层 R6：深墨压暗全屏 → 大捷/败北 → 星级 → 单一结算按钮
标题层 R1：全幅赵云水墨图 → 品牌 → 星级 → 单一开始按钮
```

## Skill Hit Matrix

项目没有可匹配游戏 Canvas 节点的组件技能注册表；日期、表格、表单类模板均不适用，因此遵循“未命中时用项目原生实现”的规则。

| node_id | node_type | selected_skill | reason | handoff_payload | fallback |
| --- | --- | --- | --- | --- | --- |
| `R1,R6` | scene | `frontend-skill` | 强视觉层级、单一主行动、图像主导 | 全画布、朱砂 CTA、两种字体以内 | Canvas 场景函数 |
| `R2,R4,R5` | utility-ui | `frontend-skill` | 需要克制的信息层级与操作层级 | 状态、营栏、三主操作 | Canvas 原生控件 |
| `R3` | game-board | `unmatched` | 无战棋 Canvas 组件技能 | 9×10 网格、拖放、路径、特效 | 现有 Canvas 渲染器 |
| `R3-C1` | tile-card | `unmatched` | 项目内已有可维护的字牌实现 | 字、等级、种类、状态 | 增强现有 `drawCard` |
| `R3-C2` | enemy-token | `imagegen + canvas` | 素材负责氛围，Canvas 负责状态和文字 | 五类轮廓、墨色、血条 | 程序化印章轮廓 |
| `background` | game-environment | `imagegen` | 需要位图水墨纵深，代码纹理不足 | 1:2、中心低对比、无 UI/文字 | 现有纸纹缓存 |

## 自动化与验收矩阵

| 场景 | 自动化层 | Chrome 层 | 截图 |
| --- | --- | --- | --- |
| 正常/异常存档读取 | 单元测试 | 新文档加载 | `01-title-progress.png` |
| 馒头不足、营栏已满、获得铲子 | 单元测试 | 代表性征兵 | - |
| 败北后重整同一关 | 控制器测试 | 实际点击 | `04-defeat-replay.png` |
| 第五关完成与五星重玩 | 控制器测试 | 新文档 + 开始 | `05-five-star-victory.png` |
| 拖兵、开战、暂停、倍速 | 战斗集成测试 | 实际鼠标 | `02-battle-deployed.png` |
| 水墨视觉与移动布局 | 截图尺寸检查 | 桌面 + 390×844 | `03-battle-mobile.png` |
| 控制台质量 | - | warning/error 为 0 | 写入截图清单 |

## Implementation Plan

| file | responsibility | source_skills | risk |
| --- | --- | --- | --- |
| `src/campaign.js` | 存档异常降级，结算不误标成功 | `guo-super` | 失败时不得错误解锁 |
| `src/game-controller.js` | 可测试的重试/下一关/凯旋控制链 | `karpathy-guidelines` | 不改变现有 UI 行为 |
| `src/actions.js` | 征兵资源边界与确定性抽取 | `karpathy-guidelines` | 保持音效和浮字由输入层负责 |
| `src/render-theme.js` | 背景素材、纸纹、圆角与视觉令牌 | `frontend-skill,imagegen` | 素材加载失败必须回退 |
| `src/render.js` | 集成视觉主题，强化棋盘/敌人/营栏/结算 | `frontend-skill` | 不能降低字牌可读性 |
| `src/main.js` | 接入控制器、存档状态、浏览器测试状态 | `guo-super` | 维持调试数据集兼容 |
| `test/*` | RED→GREEN 覆盖 U1/U2/U7/U10 与控制链 | `guo-super` | 测行为，不绑渲染细节 |
| `test-artifacts/screenshots/` | 保存关键 Chrome 截图和清单 | `chrome:control-chrome` | 不保存临时失败图冒充验收图 |

## 完成标准

1. 新增边界测试先失败，再由最小生产改动变绿；全量 `npm test` 通过。
2. 存储读写抛错不会使游戏崩溃，也不会错误解锁下一关。
3. 失败重试和五星重玩在控制器测试及 Chrome 中至少各验证一次。
4. 新战场素材已复制进 `assets/` 并在加载失败时退回程序化纸纹。
5. 390×844 与桌面 Chrome 关键画面无裁切、无遮挡，控制台无 warning/error。
6. 至少保存标题、布阵战斗、移动战斗、失败或胜利四类关键截图，并附清单。

## U/P 可追踪状态矩阵（第二轮）

旧会话只留下“U1/U2/U7/U10”引用，没有完整编号定义。为避免把缺失编号冒充完成状态，后续改用稳定语义 ID。

| id | 类型 | 状态 | 验收证据 | 尚缺 |
| --- | --- | --- | --- | --- |
| `U-STORAGE` | 未测 | 完成 | `runtime-test`、`campaign-test`：读写异常与会话影子 | 多标签实时同步 |
| `U-DRAG` | 未测 | 完成 | `actions-test`：取消、R 抢槽、重复起拖；Chrome 无效落点 | 真机多指触控 |
| `U-CLOCK` | 未测 | 完成 | `clock-test`：后台冻结、恢复首帧、时钟倒退 | 浏览器长时间性能采样 |
| `U-COMBAT` | 未测 | 完成 | `combat-types-test`：生命非负、弹道跨越、命中/击杀反馈 | 无 |
| `U-STRESS` | 未测 | 完成 | `stability-test`：1852 秒、26 局真实第五关压力 | 实机帧率与堆内存 |
| `U-CAMPAIGN` | 未测 | 部分完成 | Node 连续五关；Chrome 第五关 Boss/胜利/失败/重试 | Chrome 从空存档连续 1→5 的可重复脚本 |
| `U-OPERATIONS` | 未测 | 部分完成 | Chrome：暂停、征兵、合成、铲地、无效拖拽 | 英雄自然招募与五大招逐项截图 |
| `U-MOBILE` | 未测 | 部分完成 | 390×844 Chrome 视口与 DPR | iOS/Android 真机 |
| `U-BROWSERS` | 未测 | 未完成 | 当前仅 Chrome | Safari/Firefox/Edge |
| `P-VISUAL` | 优化 | 完成 | 水墨标题/战场、页面延展、Boss 素材、暂停/结算层 | 后续可补兵种/英雄头像 |
| `P-BOSS-HUD` | 优化 | 完成 | Boss 满血常驻条、面具、入场、受击反馈 | 无 |
| `P-MODULAR` | 优化 | 完成 | 渲染拆为 `render`、`render-enemies`、`render-battle-hud` | 无 |
| `P-STAGES` | 优化 | 部分完成 | 五关名称、倍率、快兵/坦克/Boss 差异 | 独立地图与特殊目标 |
| `P-E2E` | 优化 | 部分完成 | Chrome 真实操作与项目截图清单 | npm 可一键复跑浏览器动作 |
| `P-CHAPTERS` | 优化 | 未完成 | 当前五星后只重玩第五关 | 章节选择与旧关重玩 UI |

“完成”只表示表内验收已运行；“部分完成/未完成”不会在交付说明中写成全部完成。
