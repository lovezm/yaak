# 加密 Key 入口与弹窗汉化计划

- [x] 定位加密 key 入口和弹窗里的未汉化文案
- [x] 为加密入口按钮与弹窗接入中文文案
- [x] 更新任务记录与 lessons，并跑前端校验

## Review

- 已确认未汉化文案集中在 `WorkspaceHeader`、`setupOrConfigureEncryption`、`WorkspaceEncryptionSetting` 和 `EncryptionHelp`，包含顶部 `Enter Encryption Key`、弹窗标题、说明、输入框标签、按钮和忘记 key 的确认提示
- 已在 `WorkspaceHeader.tsx`、`setupOrConfigureEncryption.tsx`、`WorkspaceEncryptionSetting.tsx` 和 `EncryptionHelp.tsx` 中把加密入口按钮、弹窗标题、说明文案、输入标签、确认按钮、忘记 key 提示、复制/显示密钥提示统一接入 `t(...)`
- 已在 `i18n.ts` 中补齐 `Enter Encryption Key`、`Workspace Encryption`、`Workspace encryption key`、`Forgot your key?`、`Enable Encryption`、`Disable Encryption` 等中文词条
- 前端校验通过：`npm run --workspace src-web lint`
