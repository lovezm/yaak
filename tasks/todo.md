# GitHub Release 自动与手动更新入口计划

- [x] 定位右上角顶栏组件与当前 release 版本写入逻辑
- [x] 实现 GitHub Release 版本检查入口和按系统打开下载链接
- [x] 调整 Actions 发布版本标识并做校验
- [x] 更新任务记录与 lessons

# 旧更新提示跳转修复计划

- [x] 定位启动后右下角旧更新提示的真实来源
- [x] 切掉遗留的上游 updater 链路，统一只保留 GitHub Release 更新入口
- [x] 更新任务记录与 lessons，并重新校验前端和 Rust

## Review

- 已在右上角新增手动“检查更新”按钮，点击后会请求 `lovezm/yaak` 的 GitHub Release 信息并比较本地版本
- 已增加静默自动检查：应用启动和窗口重新聚焦时会按节流规则检查 GitHub Release，有新版本时在右上角显示 `有新版本 vX.X.X`
- 若有新版本，会按当前系统优先选择对应安装包下载地址：macOS 走 `.dmg`，Windows 走 `.exe`
- 已把工作流发布标题与说明改成真实版本号，版本来源与应用内 `YAAK_VERSION` 保持一致
- 已关闭旧的上游 Tauri 自动更新入口与前端可见标记，避免 fork 版继续提示上游更新
- 前端校验通过：`npm run --workspace src-web lint`
- Rust 编译检查通过：`cargo check`
- Workflow YAML 校验通过

## Review

- 已定位到问题不是新的 GitHub 更新按钮，而是项目里残留的旧 Tauri updater 链路：前端还监听 `update_available/update_installed`，Rust 端仍保留 updater 插件注册与 `cmd_check_for_updates`
- 已移除旧 updater 的前端监听、Tauri 命令、插件注册和状态管理，避免启动后再弹出跳向上游的更新 toast
- 已删除废弃的 `crates-tauri/yaak-app/src/updates.rs` 模块，并同步清理对应错误类型，避免后续构建持续出现死代码警告
- 已确认当前源码里不再存在旧 updater 入口；保留的更新能力只剩基于 `lovezm/yaak` GitHub Release 的手动检查、自动检查和右上角新版本提示
- 前端校验通过：`npm run --workspace src-web lint`
- Rust 编译检查通过：`cargo check`
