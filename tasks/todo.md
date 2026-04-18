# Actions 打包提速优化计划

- [x] 调整 release workflow，移除重复 bootstrap 并增加 vendored/wasm-pack 缓存
- [x] 更新任务记录
- [x] 校验 workflow 语法与变更结果

## Review

- 已移除工作流里显式的 `npm run bootstrap`，避免与 `tauri.conf.json` 里的 `beforeBuildCommand` 重复执行
- 已为 `wasm-pack` 增加缓存，减少干净 runner 上重复安装开销
- 已为 `vendored/node`、`vendored/protoc`、`vendored/plugins`、`vendored/plugin-runtime` 增加缓存，减少每次打包时的重复下载与拷贝
- 已用 `ruby` 解析 workflow，确认 `.github/workflows/release-fork-overwrite.yml` 的 YAML 语法有效
