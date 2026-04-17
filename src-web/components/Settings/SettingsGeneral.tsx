import { revealItemInDir } from "@tauri-apps/plugin-opener";
import { patchModel, settingsAtom } from "@yaakapp-internal/models";
import { useAtomValue } from "jotai";
import { activeWorkspaceAtom } from "../../hooks/useActiveWorkspace";
import { useCheckForUpdates } from "../../hooks/useCheckForUpdates";
import { appInfo } from "../../lib/appInfo";
import { t } from "../../lib/i18n";
import { revealInFinderText } from "../../lib/reveal";
import { CargoFeature } from "../CargoFeature";
import { Checkbox } from "../core/Checkbox";
import { Heading } from "../core/Heading";
import { IconButton } from "../core/IconButton";
import { KeyValueRow, KeyValueRows } from "../core/KeyValueRow";
import { PlainInput } from "../core/PlainInput";
import { Select } from "../core/Select";
import { Separator } from "../core/Separator";
import { VStack } from "../core/Stacks";

export function SettingsGeneral() {
  const workspace = useAtomValue(activeWorkspaceAtom);
  const settings = useAtomValue(settingsAtom);
  const checkForUpdates = useCheckForUpdates();

  if (settings == null || workspace == null) {
    return null;
  }

  return (
    <VStack space={1.5} className="mb-4">
      <div className="mb-4">
        <Heading>{t("General")}</Heading>
        <p className="text-text-subtle">
          {t("Configure general settings for update behavior and more.")}
        </p>
      </div>
      <CargoFeature feature="updater">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-1">
          <Select
            name="updateChannel"
            label={t("Update Channel")}
            labelPosition="left"
            labelClassName="w-[14rem]"
            size="sm"
            value={settings.updateChannel}
            onChange={(updateChannel) => patchModel(settings, { updateChannel })}
            options={[
              { label: t("Stable"), value: "stable" },
              { label: t("Beta (more frequent)"), value: "beta" },
            ]}
          />
          <IconButton
            variant="border"
            size="sm"
            title={t("Check for updates")}
            icon="refresh"
            spin={checkForUpdates.isPending}
            onClick={() => checkForUpdates.mutateAsync()}
          />
        </div>

        <Select
          name="autoupdate"
          value={settings.autoupdate ? "auto" : "manual"}
          label={t("Update Behavior")}
          labelPosition="left"
          size="sm"
          labelClassName="w-[14rem]"
          onChange={(v) => patchModel(settings, { autoupdate: v === "auto" })}
          options={[
            { label: t("Automatic"), value: "auto" },
            { label: t("Manual"), value: "manual" },
          ]}
        />
        <Checkbox
          className="pl-2 mt-1 ml-[14rem]"
          checked={settings.autoDownloadUpdates}
          disabled={!settings.autoupdate}
          help={t(
            "Automatically download Yaak updates (!50MB) in the background, so they will be immediately ready to install.",
          )}
          title={t("Automatically download updates")}
          onChange={(autoDownloadUpdates) => patchModel(settings, { autoDownloadUpdates })}
        />

        <Checkbox
          className="pl-2 mt-1 ml-[14rem]"
          checked={settings.checkNotifications}
          title={t("Check for notifications")}
          help={t("Periodically ping Yaak servers to check for relevant notifications.")}
          onChange={(checkNotifications) => patchModel(settings, { checkNotifications })}
        />
        <Checkbox
          disabled
          className="pl-2 mt-1 ml-[14rem]"
          checked={false}
          title={t("Send anonymous usage statistics")}
          help={t("Yaak is local-first and does not collect analytics or usage data 🔐")}
          onChange={(checkNotifications) => patchModel(settings, { checkNotifications })}
        />
      </CargoFeature>

      <Separator className="my-4" />

      <Heading level={2}>
        {t("Workspace")}{" "}
        <div className="inline-block ml-1 bg-surface-highlight px-2 py-0.5 rounded text text-shrink">
          {workspace.name}
        </div>
      </Heading>
      <VStack className="mt-1 w-full" space={3}>
        <PlainInput
          required
          size="sm"
          name="requestTimeout"
          label={t("Request Timeout (ms)")}
          labelClassName="w-[14rem]"
          placeholder="0"
          labelPosition="left"
          defaultValue={`${workspace.settingRequestTimeout}`}
          validate={(value) => Number.parseInt(value, 10) >= 0}
          onChange={(v) =>
            patchModel(workspace, { settingRequestTimeout: Number.parseInt(v, 10) || 0 })
          }
          type="number"
        />

        <Checkbox
          checked={workspace.settingValidateCertificates}
          help={t(
            "When disabled, skip validation of server certificates, useful when interacting with self-signed certs.",
          )}
          title={t("Validate TLS certificates")}
          onChange={(settingValidateCertificates) =>
            patchModel(workspace, { settingValidateCertificates })
          }
        />

        <Checkbox
          checked={workspace.settingFollowRedirects}
          title={t("Follow redirects")}
          onChange={(settingFollowRedirects) =>
            patchModel(workspace, {
              settingFollowRedirects,
            })
          }
        />
      </VStack>

      <Separator className="my-4" />

      <Heading level={2}>{t("App Info")}</Heading>
      <KeyValueRows>
        <KeyValueRow label={t("Version")}>{appInfo.version}</KeyValueRow>
        <KeyValueRow
          label={t("Data Directory")}
          rightSlot={
            <IconButton
              title={revealInFinderText}
              icon="folder_open"
              size="2xs"
              onClick={() => revealItemInDir(appInfo.appDataDir)}
            />
          }
        >
          {appInfo.appDataDir}
        </KeyValueRow>
        <KeyValueRow
          label={t("Logs Directory")}
          rightSlot={
            <IconButton
              title={revealInFinderText}
              icon="folder_open"
              size="2xs"
              onClick={() => revealItemInDir(appInfo.appLogDir)}
            />
          }
        >
          {appInfo.appLogDir}
        </KeyValueRow>
      </KeyValueRows>
    </VStack>
  );
}
