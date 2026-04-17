# GitHub 自动检查关闭计划

- [x] 检查当前仓库哪些 GitHub Actions 仍会自动触发
- [x] 关闭不需要的自动检查触发，仅保留手动触发
- [x] 更新任务记录并验证工作流语法

## Review

- 已确认当前推送后自动跑的是 `.github/workflows/ci.yml` 的 `Lint and Test`
- 已将 `ci.yml` 从 `push` / `pull_request` 改成仅 `workflow_dispatch`
- 验证通过：`ruby -e 'require "yaml"; YAML.load_file(".github/workflows/ci.yml"); puts "yaml ok"'`
- 现在这条检查不会再在 `git push` 后自动触发，只能在 GitHub 的 `Actions` 页面手动运行
