import { type } from "@tauri-apps/plugin-os";
import { t } from "./i18n";

const os = type();
export const revealInFinderText =
  os === "macos"
    ? t("Reveal in Finder")
    : os === "windows"
      ? t("Show in Explorer")
      : t("Show in File Manager");
