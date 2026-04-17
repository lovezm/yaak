import { openUrl } from "@tauri-apps/plugin-opener";
import { useLicense } from "@yaakapp-internal/license";
import { useRef } from "react";
import { openSettings } from "../commands/openSettings";
import { useCheckForUpdates } from "../hooks/useCheckForUpdates";
import { useExportData } from "../hooks/useExportData";
import { appInfo } from "../lib/appInfo";
import { showDialog } from "../lib/dialog";
import { t } from "../lib/i18n";
import { importData } from "../lib/importData";
import type { DropdownRef } from "./core/Dropdown";
import { Dropdown } from "./core/Dropdown";
import { Icon } from "./core/Icon";
import { IconButton } from "./core/IconButton";
import { KeyboardShortcutsDialog } from "./KeyboardShortcutsDialog";

export function SettingsDropdown() {
  const exportData = useExportData();
  const dropdownRef = useRef<DropdownRef>(null);
  const checkForUpdates = useCheckForUpdates();
  const { check } = useLicense();

  return (
    <Dropdown
      ref={dropdownRef}
      items={[
        {
          label: t("Settings"),
          hotKeyAction: "settings.show",
          leftSlot: <Icon icon="settings" />,
          onSelect: () => openSettings.mutate(null),
        },
        {
          label: t("Keyboard shortcuts"),
          hotKeyAction: "hotkeys.showHelp",
          leftSlot: <Icon icon="keyboard" />,
          onSelect: () => {
            showDialog({
              id: "hotkey",
              title: t("Keyboard Shortcuts"),
              size: "dynamic",
              render: () => <KeyboardShortcutsDialog />,
            });
          },
        },
        {
          label: t("Plugins"),
          leftSlot: <Icon icon="puzzle" />,
          onSelect: () => openSettings.mutate("plugins"),
        },
        { type: "separator", label: t("Share Workspace(s)") },
        {
          label: t("Import Data"),
          leftSlot: <Icon icon="folder_input" />,
          onSelect: () => importData.mutate(),
        },
        {
          label: t("Export Data"),
          leftSlot: <Icon icon="folder_output" />,
          onSelect: () => exportData.mutate(),
        },
        {
          label: t("Create Run Button"),
          leftSlot: <Icon icon="rocket" />,
          onSelect: () => openUrl("https://yaak.app/button/new"),
        },
        { type: "separator", label: `Yaak v${appInfo.version}` },
        {
          label: t("Check for updates"),
          leftSlot: <Icon icon="update" />,
          hidden: !appInfo.featureUpdater,
          onSelect: () => checkForUpdates.mutate(),
        },
        {
          label: t("Purchase License"),
          color: "success",
          hidden: check.data == null || check.data.status === "active",
          leftSlot: <Icon icon="circle_dollar_sign" />,
          rightSlot: <Icon icon="external_link" color="success" className="opacity-60" />,
          onSelect: () => openUrl("https://yaak.app/pricing"),
        },
        {
          label: t("Install CLI"),
          hidden: appInfo.cliVersion != null,
          leftSlot: <Icon icon="square_terminal" />,
          rightSlot: <Icon icon="external_link" color="secondary" />,
          onSelect: () => openUrl("https://yaak.app/docs/cli"),
        },
        {
          label: t("Feedback"),
          leftSlot: <Icon icon="chat" />,
          rightSlot: <Icon icon="external_link" color="secondary" />,
          onSelect: () => openUrl("https://yaak.app/feedback"),
        },
        {
          label: t("Changelog"),
          leftSlot: <Icon icon="cake" />,
          rightSlot: <Icon icon="external_link" color="secondary" />,
          onSelect: () => openUrl(`https://yaak.app/changelog/${appInfo.version}`),
        },
      ]}
    >
      <IconButton
        size="sm"
        title={t("Main Menu")}
        icon="settings"
        iconColor="secondary"
        className="pointer-events-auto"
      />
    </Dropdown>
  );
}
