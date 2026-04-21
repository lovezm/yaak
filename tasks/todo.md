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

# Windows 安装报错排查

- [x] 定位 Windows 安装时报 `yaaknode.exe` 写入失败的可能根因
- [x] 确认是安装器行为还是应用运行占用，并找出打包层面的结论
- [x] 更新任务记录并输出处理建议

## Review

- 报错文件 `d:\\Yaak\\vendored\\node\\yaaknode.exe` 是应用内置的 Node sidecar，来自 Tauri 打包资源配置 `vendored/node/yaaknode*`
- 当前 fork 的 Windows 构建走的是 `.github/workflows/release-fork-overwrite.yml`，直接使用 `tauri.conf.json` 产出 NSIS 安装包，没有接上上游 `tauri.release.conf.json` 里的 Windows 签名流程
- 结合报错形态，最可能的两个原因是：
  1. 旧版本 `Yaak.exe` 或残留的 `yaaknode.exe` 进程仍占用该文件，安装器无法覆盖写入
  2. 因为当前 fork 构建产物未签名，Windows Defender/杀软在解包到 `yaaknode.exe` 时拦截或短暂锁定该文件
- 这类报错更像安装环境问题，不是应用逻辑问题；当前源码里没有发现会导致安装器写错路径的自定义逻辑

# 请求面板加解密工具计划

- [x] 梳理请求面板现有标签结构与可复用依赖
- [x] 实现独立的加解密选项卡，支持常用算法、动态参数和双向输入输出
- [x] 补充中文文案、任务记录并完成前端校验

## Review

- 已在请求面板里新增独立的 `加解密` 选项卡，并放在 `重定向` 后面
- 已接入常用算法与编码工具：`AES`、`DES`、`3DES`、`RC4`、`Rabbit`、`RSA`、`MD5`、`SHA1`、`SHA256`、`SHA512`、`Base64`、`Hex`、`URL Encode`、`URL Component`
- 已按算法动态显示参数区：对称算法会显示密钥、模式、填充、IV 和编码；`RSA` 会显示公钥/私钥；摘要和编码算法只保留必要输入
- 已实现双向输入输出：点击“加密”从待加密数据写到加密数据框，点击“解密”从加密数据框回填到待加密数据框；摘要算法会明确提示“不支持解密”
- 已新增前端依赖 `crypto-js`、`jsencrypt` 与 `@types/crypto-js`
- 前端校验通过：`npm run --workspace src-web lint`
- 已按界面纠正重排布局：密钥与 IV 改为单行输入，待加密数据与加密数据保留多行，窄屏时纵向堆叠，宽屏时为左右双栏加中间按钮
- 已为“密文编码”补充 `None / 原始` 选项，支持直接输出和解析原始字节文本，不再强制只用 Base64 或 Hex
- 已按调试型使用习惯简化对称算法参数：`AES`、`DES`、`3DES`、`RC4`、`Rabbit` 的密钥和 `IV` 统一按普通文本输入，不再额外要求选择密钥编码或 `IV` 编码
- 已修正代码生成的模板取值：生成 `cURL`、`Python httpx`、`易语言` 时，会优先使用 URL、请求头、正文的发送前渲染结果，不再把 `secure(...)` 等模板原样带进代码
- 已把代码生成里的 `Python httpx` 标签收敛为 `Python`，并补充 `Java`、`Rust` 两种常用语言模板
- 已把生成代码显示层改成语法高亮组件：`Rust` 使用对应高亮，`易语言` 使用轻量 `basic` 高亮，避免两者再以纯文本显示
- 已把易语言高亮进一步改成专用语义着色：`函数名()` 使用主色，`变量名 =` 使用信息色，字符串与注释也会单独区分

# 正文重复标题修复

- [x] 去掉正文页内部重复的小标题
- [x] 更新任务记录与 lessons，并完成前端校验

## Review

- 已移除正文页内部重复的小型 `正文 / Body` 标题，保留上层主标签和正文类型切换按钮
- 这样正文区域会更干净，不会再出现“主标签已经叫正文，内部又重复出现一个正文”的视觉重复
- 前端校验通过：`npm run --workspace src-web lint`

# JSON 响应节点复制计划

- [x] 梳理 JSON 响应当前渲染链与可复用树组件
- [x] 实现文本/树视图切换与节点复制交互
- [x] 更新任务记录与 lessons，并完成前端校验

## Review

- 已在 JSON 响应查看区新增 `文本 / 树` 视图切换，不改变现有文本查看习惯
- 树视图复用了现有 `JsonViewer` 与 `JsonAttributeTree`，节点悬停时会显示 `值 / 路径` 两个复制按钮
- `复制值` 会按节点类型输出最适合直接使用的内容：字符串复制原值，对象和数组复制格式化后的 JSON，数字/布尔/null 复制字面值
- `复制路径` 会复制从根节点开始的 JSON 路径，例如 `$.data.results[0].card_code`
- 已修正根路径处理，避免根节点或标量 JSON 出现 `undefined:` 这类异常显示
- 前端校验通过：`npm run --workspace src-web lint`
