# 易语言代码生成计划

- [x] 确认当前代码生成面板只有 `cURL` 和 `Python httpx`
- [x] 为生成面板新增易语言选项
- [x] 按用户给的规则分别处理表单文本和 JSON 正文
- [x] 调整文案与代码高亮配置
- [x] 更新 lessons 并运行前端检查

## Review

- 响应面板的代码生成现在新增了易语言选项，和现有 `cURL`、`Python httpx` 并列
- `application/x-www-form-urlencoded` 且正文可解析时，会按你给的模板生成 `类_POST数据类` 的 `.添加 (...)` 形式；JSON 和其它文本正文则生成 `局_提交数据 = ...` 的字符串表达式
- 易语言代码会保留请求头写入逻辑，并继续沿用当前请求的真实 method / URL / headers / body
- 文案已补充 `易语言` 标签，编辑器高亮对这一项改用纯文本模式，避免错误套用 Python / shell 高亮
- 验证通过：`npm run --workspace src-web lint`
