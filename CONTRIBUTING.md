# 贡献指南 (Contributing)

感谢参与 AImimi Engine。提交前请过一遍以下约定。

## 提交信息 (Commit Message)

本仓库遵循 [Conventional Commits](https://www.conventionalcommits.org/)：`<type>(<scope>): <subject>`。
完整的 type 说明见 [docs/CONVENTIONS.md §三](docs/CONVENTIONS.md)。

**两种写法，任选：**

- **省事（推荐）**：交互式选单，不用记语法

  ```bash
  npm install
  npm run commit
  ```

- **手写**：照格式写即可，CI 会校验

  ```bash
  git commit -m "docs: 修正快速开始里的构建命令"
  ```

## PR 标题 (Pull Request Title)

本仓库采用 **Squash 合并**，进入 `main` 历史的**只有 PR 标题**，
所以 **PR 标题本身必须符合上面的 Conventional Commits 格式**，CI 会自动检查（不合规无法合并）。
PR 里的零散 commit 会在 squash 后折进正文，不影响主干的标题行。

## 提交前自检 (Before You Push)

```bash
npm run check   # 类型检查 + ESLint + Prettier
npm run test    # 单元测试
```

husky 会在本地 `git commit` 时自动跑 lint-staged 与 commitlint；
但请以 CI 为准 —— 本地钩子可被 `--no-verify` 绕过，服务端检查才是最终闸门。
