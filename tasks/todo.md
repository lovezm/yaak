# Params 与 URL 同步计划

- [x] 确认当前 `Params` 编辑只更新 `urlParameters`，不会同步重建 URL 输入框内容
- [x] 新增根据参数列表重建 URL 的工具函数
- [x] 在 HTTP / WebSocket 请求面板接入本地即时 URL 同步
- [x] 更新 lesson 并运行前端检查

## Review

- 新增 [buildUrlFromParameters.ts](/Users/xiaowang/Desktop/yaak/src-web/lib/buildUrlFromParameters.ts:1)，会把路径参数替换回 URL，并用普通参数重建 querystring，同时保留 fragment
- `HttpRequestPane` 和 `WebsocketRequestPane` 都改成使用本地 `localUrl` 即时态；编辑 `Params` 时会先本地刷新地址栏，再异步写回模型
- 直接在 URL 栏粘贴带 querystring 的地址时，也会先同步本地 URL，避免地址栏和参数面板出现短暂不一致
- 验证通过：执行 `npm run --workspace src-web lint`，即 `tsc --noEmit`
