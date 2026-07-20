# 多维护者开发与集成流程

## 角色

| 角色 | 可以修改 | 不可以修改 |
|---|---|---|
| 系统维护者 | `system-ownership.json` 中所属 `ownedPaths`、专项测试和系统文档 | 其他系统 internal、总装配、生成模块和测试总编排 |
| 契约维护者 | 独立契约提交中的版本、公共入口与跨系统测试 | 将具体玩法塞入 foundation |
| 集成负责人 | composition root、更新顺序、生成产物、CI、截图与跨系统接线 | 在集成提交中顺手新增玩法 |
| 发布审查者 | 验证集成 SHA、测试、截图和 main 差异 | 在未复验时直接合并 main |

未知真实 GitHub 用户名/团队时不创建虚假 `CODEOWNERS`；当前使用 ownerRole、机器门禁和 PR 清单。

`architecture/system-ownership.json.governedPaths` 是受治理文件的唯一机器清单，同时覆盖生产源码、Game Pack、构建脚本、GitHub 配置、架构清单/文档和根级治理文件。边界测试由该清单递归发现文件并要求恰好一个 owner，不再维护第二份硬编码扫描目录。

## 1. 获取统一基线

```bash
git clone https://github.com/guoxq971/zhaoyunadou.git
cd zhaoyunadou
git fetch origin
git rev-parse <集成分支>
```

维护周期必须由集成负责人公布一个完整测试通过的准确 SHA，不能只写“最新分支”。本次重构的输入基线是：

```text
9796962a76cdc222b94d2e1fce6d165ba1843509
```

重构完成后，系统开发以远程分支 `origin/codex/refactor-modular-foundation` 为发布基线。维护者在创建 worktree 前必须执行：

```bash
git fetch origin
git rev-parse origin/codex/refactor-modular-foundation
```

只使用本次最终交付公布的完整 SHA；不把本地短 SHA、未推送 HEAD 或浮动的“最新”当作多人基线。

## 2. 创建系统 worktree

```bash
git worktree add -b codex/sys-board-route-query ../zhaoyun-adou-board-route <统一基线SHA>
cd ../zhaoyun-adou-board-route
git status --short --branch
```

分支格式固定为 `codex/sys-<system>-<feature>`。目录存在、分支已存在或状态不干净时停止，不能清理或复用未知改动。

## 3. 开发与专项验证

1. 先读仓库和目标目录的 `AGENTS.md`。
2. 在 `architecture/system-ownership.json` 确认 ownedPaths、allowedDependencies、commands/events 和 requiredTests。
3. RED：先补能复现契约/行为的失败测试。
4. GREEN：只修改所属系统，通过公共入口使用依赖。
5. REFACTOR：运行专项测试、边界测试、Pack 校验和 `git diff --check`。

```bash
npm run test:boundaries
npm run game-pack:validate
node test/board-system-test.mjs # 例：按 requiredTests 选择所属系统真实测试
git diff --check
```

内容维护者只改分系统人工来源，不手工修改 `balance.json` 或 `generated-manifests.js`；两个生成物只在周期集成时由集成负责人重建。

## 4. 提交和推送系统分支

```bash
git add <明确文件1> <明确文件2>
git diff --cached --name-only
git commit -m "系统: 中文变更摘要"
git push -u origin codex/sys-<system>-<feature>
```

禁止 `git add .`、`git add -A`、force push 和 AI 署名。跨系统契约必须独立提交，并在 PR 中列出受影响系统和双方专项测试。

## 5. 周期集成

集成负责人从已发布基线建立：

```text
codex/integration-game-systems-<cycle>
```

按“契约 → 被依赖系统 → 依赖系统 → 总装配”顺序引入已审查提交。复杂冲突停止并退回系统分支解决，不在集成分支猜测业务语义。

集成负责人统一执行：

```bash
npm run balance:build
npm run game-pack:build
git diff -- games/zhaoyun-adou/balance.json games/zhaoyun-adou/generated-manifests.js
npm run game-pack:validate
npm run test:boundaries
npm test
```

源码指纹变化后必须在真实 Chrome 重采截图，更新 raw capture、manifest 和浏览器报告，再次运行 `npm test`。

`integrationRoots` 是长期存在的组合根，不以“调用方清零”为删除目标；`compatibilityFacades` 是迁移面，只能在清单中记录的真实调用方全部转入公开入口后删除。

`compatibilityFacades[].status = retained` 表示仍有生产或兼容测试调用，必须保留；只有生产与测试调用都归零且删除条件已验证时，才可在独立迁移提交中删除条目和门面。
`realCallers` 存储精确仓库路径，门禁会反向扫描 `src/test/games/scripts` 的真实 import 并要求全量相等；这使得新增隐式兼容依赖或无人清理的陈旧记录都会在 PR 中失败。

`.github/workflows/quality.yml` 对目标为 `main` 和 `codex/integration-game-systems-*` 的 PR 运行 Pack、边界与全量测试；因此系统分支先进周期集成分支，再由集成分支申请进入 `main`。

## 6. 申请合入 main 前

- [ ] 集成分支基于公布 SHA，commit 列表可审查。
- [ ] 机器边界、专项测试、Pack、生成同步、完整测试和 Chrome 截图全绿。
- [ ] 旧存档与 SaveEnvelope 迁移测试通过。
- [ ] 固定 seed、状态哈希和回放一致。
- [ ] Host 三次创建/销毁无泄漏。
- [ ] 没有 Bot、联网、原生平台或商业化占位实现。
- [ ] `main` 本地/远端 SHA 在本周期内未被任务直接修改。

只在用户确认后申请合并；普通系统分支不得直接推送 main。
