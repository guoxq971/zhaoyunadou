# 《赵云与阿斗》参考图高相似度界面规格

## 背景与目标

用户提供了标题页、常规战斗、英雄必杀、高密度战斗和小程序战斗共 5 张参考图，要求现有 Chrome 游戏向其构图与手绘质感靠近，并尽量接近 1:1。

本轮保留现有五关战役、拖放、合成、铲地、英雄、Boss、存档、键盘与触控逻辑，只重排共享几何和渲染层。真实像素级一致不作为承诺：参考图中专有角色素材、字体和未展示规则不会直接复制；验收目标是结构比例、信息密度、色彩、字牌和战斗气氛高度相似。

## 视觉与交互命题

- 视觉命题：暖宣纸上的手绘微信小游戏，粗墨线、斑驳青绿地块、砖橙木牌和高密度乱战叠层共同形成辨识度。
- 内容计划：标题页负责进度与入口；顶部 HUD 负责资源与波次；棋盘负责部署与乱战；底部三层负责营栏、主操作和技能状态。
- 交互命题：标题内容以轻微错位入场；可操作控件用墨晕/金圈反馈；英雄登场和必杀用扇形金光、火焰、箭雨及大字叠层强化存在感。

## UI Inventory

| id | level | type_guess | position | visible_text | interaction | children | confidence | notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `T1` | page | title-screen | full-canvas | `赵云与阿斗` | 进入当前关卡 | `T1-H,T1-M,T1-N,T1-A,T1-F` | `0.99` | 参考图有效画布 387×698，等比映射到约 420×758 |
| `T1-H` | section | resource-hud | top-left | `刀币、体力` | 状态展示；设置入口只作视觉状态 | `T1-H1,T1-H2,T1-H3` | `0.96` | 头像、金币、齿轮、闪电体力均直接浮在背景上 |
| `T1-M` | section | title-progress | upper-center | `赵云与阿斗、军士一、五星` | 展示关卡进度 | `-` | `0.99` | 红褐毛笔主标题，无现代卡片衬底 |
| `T1-N` | section | notice-stack | middle | `解锁提示` | 状态展示 | `-` | `0.95` | 两层灰绿色半透明通知条，遮住部分中央插画 |
| `T1-A` | control | primary-start | lower-middle | `开始游戏` | 开始当前关 | `-` | `0.99` | 暗红木牌、双描边、顶部交叉兵刃 |
| `T1-F` | section | shortcut-pair | bottom | `排行榜、武器背包` | 本轮为状态入口外观 | `-` | `0.94` | 不伪造未实现的二级页面 |
| `B1` | page | battle-screen | full-canvas | `巨鹿、第N波` | 战斗主界面 | `B1-H,B1-G,B1-C,B1-A,B1-S` | `0.99` | 逻辑画布改为 420×760，对齐参考图有效宽高比 |
| `B1-H` | section | floating-hud | top | `生命、馒头、巨鹿、第N波` | 暂停、查看资源、迎敌 | `B1-H1,B1-H2,B1-H3` | `0.99` | 移除整块现代顶栏，三组元素悬浮在宣纸上 |
| `B1-G` | section | game-board | center | `斗、兵牌、敌军` | 拖放、合成、铲地、战斗 | `B1-G1,B1-G2,B1-G3` | `0.99` | 9×10，逻辑坐标 `30,96,360×430` |
| `B1-G1` | component | terrain-grid | board-base | `苔、道路、岩石` | 选择落点 | `-` | `0.99` | 青瓷绿锁地、灰粉道路、手绘污渍和裂纹 |
| `B1-G2` | component | paper-tile | board/bench | `刀、枪、弓、骑、英雄字` | 部署、合成、拼将 | `-` | `0.99` | 暖白直角纸牌；等级为右上黑色小上标，不用圆徽章 |
| `B1-G3` | component | combat-overlay | above-board | `伤害、败、英雄名` | 战斗反馈 | `-` | `0.97` | 敌军剪影、武器轨迹、伤害数字和墨字允许密集遮挡 |
| `B1-C` | section | camp-bench | below-board | `营` | 从 5 格营栏拖牌 | `-` | `0.99` | 屋檐图标与纸牌紧贴，弱容器感 |
| `B1-A` | section | primary-actions | below-bench | `铲、征兵、袋/倍速` | 铲地、征兵、调速 | `B1-A1,B1-A2,B1-A3` | `0.99` | 两个约 64px 圆形按钮夹一个 136×62 橙褐木牌 |
| `B1-S` | section | tool-status | bottom | `军械/英雄技能状态` | 展示当前系统与大招状态 | `-` | `0.92` | 5 个黑框小格；不是新增主动技能，避免可点性误导 |

## Wireframe Sketch

```text
420×760 Canvas
┌──────────────────────────────────────┐
│ B1-H1 暂停/生命/馒头  B1-H2 巨鹿/波次  B1-H3 装备小图标 │
│                                      │
│   ┌──────── B1-G 9×10 棋盘 ────────┐   │
│   │ 斗 / 锁地 / 道路 / 兵牌 / 敌军 │   │
│   │                                │   │
│   │                         斗     │   │
│   └────────────────────────────────┘   │
│   B1-C [营][槽][槽][槽][槽][槽]       │
│                                      │
│   B1-A [圆铲] [  橙色征兵  ] [圆袋/速] │
│                                      │
│   B1-S [铲][农][招][刃][箭]            │
└──────────────────────────────────────┘

标题页
┌──────────────────────────────────────┐
│ T1-H 头像 [刀币]  齿轮 [体力]         │
│          T1-M 赵云与阿斗               │
│              军士一 / ★☆☆☆☆          │
│   T1-N [通知条]                       │
│        [通知条]                       │
│           中央水墨人物/卷轴            │
│        T1-A [双剑 开始游戏]            │
│   T1-F [排行榜]              [武器背包] │
└──────────────────────────────────────┘
```

## 参考几何映射

| 区域 | 参考图典型值 | 420×760 逻辑值 | 验收 |
| --- | --- | --- | --- |
| 棋盘 | 宽约 340–345、高约 424–429 | `x=30,y=96,w=360,h=430`，单格 `40×43` | 左右边距 30，保持 9×10；射程仍按 40 计算 |
| 营栏 | 棋盘后约 10px；高约 58px | `y=542,h=52` | 棋盘与营栏不相交 |
| 主操作 | 圆钮约 60px，征兵约 130×60 | 铲 `44,604,64×64`；征兵 `142,606,136×62`；速 `312,604,64×64` | 视觉圆、热区均不小于 44px |
| 技能栏 | 5 格合计约 316×52 | 起点 `x=48,y=680`；单格 `58×52`；间距 `6` | 五格完整处于画布内 |
| 顶部 HUD | 左资源、中波次、右装备 | 暂停 `40,10,48×48`；迎敌 `138,58,144×34` | 与棋盘和彼此不冲突 |
| 标题开始 | 参考图约画布 y=470/698 | `x=110,y=510,w=200,h=68` | 点击中心进入关卡 |

## Skill Hit Matrix

项目没有现成的 Canvas 游戏组件技能注册表，因此使用最小注册策略：截图分层由 `prototype-to-component` 负责，视觉系统由 `frontend-skill` 负责，所有具体 Canvas 节点标记为 `unmatched` 并按项目现有模块兜底，不强行套用表单/表格类组件技能。

| node_id | node_type | selected_skill | skill_path | reason | handoff_payload | fallback |
| --- | --- | --- | --- | --- | --- | --- |
| `T1` | title-screen | `frontend-skill` | `/Users/guoxq/.codex/skills/frontend-skill/SKILL.md` | 全屏主视觉、品牌层级与入场动效完全匹配 | 暖宣纸、毛笔标题、一个主操作 | `src/render-title.js` 原生 Canvas |
| `B1-H` | floating-hud | `unmatched` | `-` | 无现成 Canvas HUD 组件技能 | 左资源、中波次、右状态图标 | `src/render-battle-hud.js` |
| `B1-G` | game-board | `unmatched` | `-` | 项目专属 9×10 战斗棋盘 | 几何、地块、拖放反馈 | `src/render.js` |
| `B1-C,B1-A,B1-S` | battle-controls | `unmatched` | `-` | 项目专属营栏和军械状态 | 5 格营栏、三主控、5 工具槽 | `src/render-battle-controls.js` |
| `B1-G3` | combat-overlay | `imagegen` + `unmatched` | `/Users/guoxq/.codex/skills/.system/imagegen/SKILL.md` | 敌军剪影适合原创透明图集，其余特效由 Canvas 承担 | 四类敌兵 2×2 图集，无文字、原创造型 | `src/render-enemies.js` + Canvas 回退 |

## Implementation Plan

| file | responsibility | source_skills | risk |
| --- | --- | --- | --- |
| `test/layout-test.mjs` | 先固定棋盘、营栏、主控、工具槽和命中边界 | `guo-super` | 新坐标未实装时应先失败 |
| `src/config.js` | 画布等比缩短，棋盘收窄并改为长格 | `prototype-to-component` | 射程仍按 cell=40 计算，玩法规则不变 |
| `src/ui-layout.js` | 所有视觉与输入共享的唯一几何源 | `karpathy-guidelines` | 任一硬编码会导致看得到点不到 |
| `src/render-title.js` | 顶部资源、标题、通知、卷轴、双剑开始、排行与背包 | `frontend-skill` | 需压低现有写实主图，避免与 UI 竞争 |
| `src/render-battle-controls.js` | 营栏、圆形控制、征兵木牌、五格军械状态 | `frontend-skill` | 工具槽不得伪装成未实现的主动技能 |
| `src/render-battle-hud.js` | 悬浮 HUD、暂停、迎敌、Boss 血条 | `prototype-to-component` | 迎敌热区必须与实际绘制一致 |
| `src/render.js` | 手绘字牌、棋盘、英雄扇光与渲染编排 | `karpathy-guidelines` | 控制单文件规模，不重构无关逻辑 |
| `src/render-enemies.js` | 接入原创透明敌军图集并保留回退 | `imagegen` | 小尺寸裁切必须保持可读性 |
| `assets/enemy-ink-atlas-v1.png` | 四类原创水墨敌军 2×2 透明图集 | `imagegen` | 不包含参考游戏专有造型或文字 |
| `test-artifacts/screenshots/2026-07-19/` | Chrome 标题、常规战斗、乱战、移动端、Boss 证据 | `browser` | 源码最终稳定后统一更新指纹 |

## 自动验收

1. `test/layout-test.mjs` 先红后绿，验证几何、热区、非重叠与画布边界。
2. `npm test` 全量通过；五关、拖放、合成、铲地、暂停、Boss、存档不得回归。
3. Chrome 真实页面至少保存 5 张本轮截图：标题、战斗待发、战斗特效、390×844、第五关 Boss。
4. 每张截图对应 Canvas dataset 状态；控制台错误与页面错误为 0。
5. 最终截图对照 UI Inventory 与 Wireframe；未覆盖或推断项在清单中显式标注。

## 不包含的内容

- 不直接复制参考游戏的专有角色、图标或字体素材。
- 不凭截图臆造排行榜、背包二级页面或 5 个新主动技能。
- 不改变现有五关数值与核心战斗结算，除非测试暴露为布局改动引入的回归。
