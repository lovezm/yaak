# GitHub Actions 打包发布计划

- [x] 梳理当前 Tauri 发布配置与现有工作流限制
- [x] 设计适合 fork 使用的自动构建与覆盖发布方案
- [x] 新增 macOS Apple Silicon 与 Windows x64 的发布工作流
- [x] 验证工作流语法与关键命令
- [x] 记录结果与使用说明

## Review

- 新增了独立工作流 `.github/workflows/release-fork-overwrite.yml`，不改动上游原有 `release-app.yml`，避免和 upstream 正式发布链路混在一起
- 新工作流支持 `push main` 和手动 `workflow_dispatch` 两种触发方式，分别构建 `macOS Apple Silicon` 与 `Windows x64`
- 发布目标使用固定 tag `autobuild` 和固定 Release 标题 `Auto Build`；每次运行会先把 tag 移到最新提交，再删除旧附件，再上传本次新产物，实现覆盖式发布
- 构建使用普通 `tauri.conf.json`，避开了上游正式发布里对苹果签名、Windows 签名、updater 私钥的依赖，更适合 fork 直接使用
- 本地验证通过：`ruby -e 'require "yaml"; YAML.load_file(".github/workflows/release-fork-overwrite.yml"); puts "yaml ok"'`
