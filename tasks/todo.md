# GitHub Release 自动与手动更新入口计划

- [x] 定位右上角顶栏组件与当前 release 版本写入逻辑
- [x] 实现 GitHub Release 版本检查入口和按系统打开下载链接
- [x] 调整 Actions 发布版本标识并做校验
- [x] 更新任务记录与 lessons

## Review

- 已在右上角新增手动“检查更新”按钮，点击后会请求 `lovezm/yaak` 的 GitHub Release 信息并比较本地版本
- 已增加静默自动检查：应用启动和窗口重新聚焦时会按节流规则检查 GitHub Release，有新版本时在右上角显示 `有新版本 vX.X.X`
- 若有新版本，会按当前系统优先选择对应安装包下载地址：macOS 走 `.dmg`，Windows 走 `.exe`
- 已把工作流发布标题与说明改成真实版本号，版本来源与应用内 `YAAK_VERSION` 保持一致
- 已关闭旧的上游 Tauri 自动更新入口与前端可见标记，避免 fork 版继续提示上游更新
- 前端校验通过：`npm run --workspace src-web lint`
- Rust 编译检查通过：`cargo check`
- Workflow YAML 校验通过
