import classNames from "classnames";
import { useAtom, useAtomValue } from "jotai";
import { memo } from "react";
import { activeWorkspaceAtom, activeWorkspaceMetaAtom } from "../hooks/useActiveWorkspace";
import { useAutoCheckForUpdates, useCheckForUpdates } from "../hooks/useCheckForUpdates";
import { useToggleCommandPalette } from "../hooks/useToggleCommandPalette";
import { updateAvailableAtom, workspaceLayoutAtom } from "../lib/atoms";
import { t } from "../lib/i18n";
import { setupOrConfigureEncryption } from "../lib/setupOrConfigureEncryption";
import { CookieDropdown } from "./CookieDropdown";
import { Icon } from "./core/Icon";
import { IconButton } from "./core/IconButton";
import { PillButton } from "./core/PillButton";
import { HStack } from "./core/Stacks";
import { EnvironmentActionsDropdown } from "./EnvironmentActionsDropdown";
import { ImportCurlButton } from "./ImportCurlButton";
import { LicenseBadge } from "./LicenseBadge";
import { RecentRequestsDropdown } from "./RecentRequestsDropdown";
import { SettingsDropdown } from "./SettingsDropdown";
import { SidebarActions } from "./SidebarActions";
import { WorkspaceActionsDropdown } from "./WorkspaceActionsDropdown";
import { openUrl } from "@tauri-apps/plugin-opener";

interface Props {
  className?: string;
}

export const WorkspaceHeader = memo(function WorkspaceHeader({ className }: Props) {
  const togglePalette = useToggleCommandPalette();
  const checkForUpdates = useCheckForUpdates();
  useAutoCheckForUpdates();
  const [workspaceLayout, setWorkspaceLayout] = useAtom(workspaceLayoutAtom);
  const workspace = useAtomValue(activeWorkspaceAtom);
  const workspaceMeta = useAtomValue(activeWorkspaceMetaAtom);
  const updateAvailable = useAtomValue(updateAvailableAtom);
  const showEncryptionSetup =
    workspace != null &&
    workspaceMeta != null &&
    workspace.encryptionKeyChallenge != null &&
    workspaceMeta.encryptionKey == null;

  return (
    <div
      className={classNames(
        className,
        "grid grid-cols-[auto_minmax(0,1fr)_auto] items-center w-full h-full",
      )}
    >
      <HStack space={0.5} className={classNames("flex-1 pointer-events-none")}>
        <SidebarActions />
        <CookieDropdown />
        <HStack className="min-w-0">
          <WorkspaceActionsDropdown />
          <Icon icon="chevron_right" color="secondary" />
          <EnvironmentActionsDropdown className="w-auto pointer-events-auto" />
        </HStack>
      </HStack>
      <div className="pointer-events-none w-full max-w-[30vw] mx-auto flex justify-center">
        <RecentRequestsDropdown />
      </div>
      <div className="flex-1 flex gap-1 items-center h-full justify-end pointer-events-none pr-1">
        <ImportCurlButton />
        {showEncryptionSetup ? (
          <PillButton color="danger" onClick={setupOrConfigureEncryption}>
            {t("Enter Encryption Key")}
          </PillButton>
        ) : (
          <LicenseBadge />
        )}
        {updateAvailable != null && (
          <PillButton
            color="primary"
            onClick={() =>
              openUrl(updateAvailable.downloadUrl ?? updateAvailable.releaseUrl ?? "https://github.com/lovezm/yaak/releases")
            }
          >
            {t("New version {version}", { version: `v${updateAvailable.version}` })}
          </PillButton>
        )}
        <IconButton
          icon={
            workspaceLayout === "responsive"
              ? "magic_wand"
              : workspaceLayout === "horizontal"
                ? "columns_2"
                : "rows_2"
          }
          title={`Change to ${workspaceLayout === "horizontal" ? "vertical" : "horizontal"} layout`}
          size="sm"
          iconColor="secondary"
          onClick={() =>
            setWorkspaceLayout((prev) => (prev === "horizontal" ? "vertical" : "horizontal"))
          }
        />
        <IconButton
          icon="refresh"
          title="检查更新"
          size="sm"
          iconColor="secondary"
          spin={checkForUpdates.isPending}
          onClick={() => checkForUpdates.mutate()}
        />
        <IconButton
          icon="search"
          title="Search or execute a command"
          size="sm"
          hotkeyAction="command_palette.toggle"
          iconColor="secondary"
          onClick={togglePalette}
        />
        <SettingsDropdown />
      </div>
    </div>
  );
});
