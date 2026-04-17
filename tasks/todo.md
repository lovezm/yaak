# 未发送请求时代码生成显示修复计划

- [x] 检查代码标签在未发送请求时的显示与渲染条件
- [x] 修复未发送请求时代码面板不显示的问题
- [x] 更新任务记录与 lessons，并跑前端校验

## Review

- 已确认 `HttpResponsePane` 在未发送时依赖内部 `getModel("http_request", id)` 读取请求；这是一份非订阅式快照，容易导致当前请求存在但仍走到空状态分支
- 已改为让主编辑页把当前 `activeRequest` 直接传给 `HttpResponsePane`，同时在面板内部订阅 `httpRequestsAtom` 作为兜底，未发送时也能直接显示代码生成
- 前端校验通过：`npm run --workspace src-web lint`
