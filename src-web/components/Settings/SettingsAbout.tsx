import { openUrl } from "@tauri-apps/plugin-opener";
import { appInfo } from "../../lib/appInfo";
import { t } from "../../lib/i18n";
import { Heading } from "../core/Heading";
import { Icon } from "../core/Icon";
import { HStack, VStack } from "../core/Stacks";

function ExternalLinkRow({
  label,
  href,
}: {
  label: string;
  href: string;
}) {
  return (
    <button
      type="button"
      onClick={() => openUrl(href)}
      className="w-full text-left rounded-md border border-border-subtle bg-surface px-3 py-3 hover:bg-surface-highlight"
    >
      <HStack justifyContent="between" alignItems="center" className="w-full">
        <VStack space={1} alignItems="start" className="min-w-0">
          <div className="text-sm text-text-subtle">{label}</div>
          <div className="font-mono text-sm text-text truncate max-w-full">{href}</div>
        </VStack>
        <Icon icon="external_link" color="secondary" />
      </HStack>
    </button>
  );
}

export function SettingsAbout() {
  return (
    <VStack space={4} className="mb-4">
      <div className="mb-2">
        <Heading>{t("About")}</Heading>
        <p className="text-text-subtle">这是 Yaak 二次开发版。</p>
      </div>

      <div className="rounded-md border border-border-subtle bg-surface px-4 py-4">
        <VStack space={2} alignItems="start">
          <div className="text-sm text-text-subtle">当前版本</div>
          <div className="text-lg font-semibold text-text">Yaak v{appInfo.version}</div>
          <div className="text-sm text-text-subtle">在原版项目基础上进行了本地化与调试体验增强。</div>
        </VStack>
      </div>

      <VStack space={2}>
        <ExternalLinkRow label="原版 GitHub 地址" href="https://github.com/mountain-loop/yaak" />
        <ExternalLinkRow label="本项目地址" href="https://github.com/lovezm/yaak" />
        <ExternalLinkRow label="联系方式 Email" href="mailto:hello.ergou@gmail.com" />
      </VStack>

      <div className="rounded-md border border-border-subtle bg-surface px-4 py-4">
        <VStack space={2} alignItems="start">
          <Heading level={2}>修改说明</Heading>
          <ul className="list-disc pl-5 space-y-1 text-sm text-text">
            <li>进行了基本功能的汉化。</li>
            <li>调整了提交数据的布局，用起来更顺手了。</li>
            <li>支持直接添加代理访问。</li>
            <li>支持禁止重定向了。</li>
            <li>支持易语言代码生成（使用网页_访问_对象）。</li>
            <li>常用 Content-Type 快捷选择和文本批量编辑请求头。</li>
            <li>还有一些小修改。</li>
          </ul>
        </VStack>
      </div>
    </VStack>
  );
}
