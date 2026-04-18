import { useMutation } from "@tanstack/react-query";
import { arch, type } from "@tauri-apps/plugin-os";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useEffect } from "react";
import { InlineCode } from "../components/core/InlineCode";
import { Button } from "../components/core/Button";
import { HStack, VStack } from "../components/core/Stacks";
import { showAlert } from "../lib/alert";
import { updateAvailableAtom, type UpdateAvailableInfo } from "../lib/atoms";
import { appInfo } from "../lib/appInfo";
import { jotaiStore } from "../lib/jotai";
import { minPromiseMillis } from "../lib/minPromiseMillis";
import { showToast } from "../lib/toast";

const RELEASE_API_URL = "https://api.github.com/repos/lovezm/yaak/releases/tags/autobuild";
const RELEASE_PAGE_URL = "https://github.com/lovezm/yaak/releases";
const AUTO_CHECK_STORAGE_KEY = "github_release_update_last_check";
const AUTO_CHECK_INTERVAL_MS = 1000 * 60 * 60 * 6;

interface GitHubReleaseAsset {
  name: string;
  browser_download_url: string;
}

interface GitHubRelease {
  tag_name: string;
  name: string;
  body: string;
  html_url: string;
  assets: GitHubReleaseAsset[];
}

export function useCheckForUpdates() {
  return useMutation({
    mutationKey: ["check_for_updates"],
    mutationFn: async () => {
      await runGitHubUpdateCheck({ silent: false, force: true });
    },
  });
}

export function useAutoCheckForUpdates() {
  useEffect(() => {
    void runGitHubUpdateCheck({ silent: true });

    const onFocus = () => {
      void runGitHubUpdateCheck({ silent: true });
    };

    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);
}

async function runGitHubUpdateCheck({
  silent,
  force = false,
}: {
  silent: boolean;
  force?: boolean;
}): Promise<void> {
  if (!force && !shouldAutoCheckNow()) {
    return;
  }

  if (!force) {
    markAutoChecked();
  }

  try {
    const release = await minPromiseMillis(fetchLatestRelease(), 500);
    const currentVersion = normalizeVersion(appInfo.version);
    const latestVersion = extractReleaseVersion(release);

    if (compareVersions(latestVersion, currentVersion) <= 0) {
      jotaiStore.set(updateAvailableAtom, null);

      if (!silent) {
        showAlert({
          id: "no-updates",
          title: "当前已是最新版本",
          body: (
            <>
              当前版本为 <InlineCode>{appInfo.version}</InlineCode>
            </>
          ),
        });
      }
      return;
    }

    const updateInfo: UpdateAvailableInfo = {
      version: latestVersion,
      downloadUrl: pickDownloadUrl(release),
      releaseUrl: release.html_url || RELEASE_PAGE_URL,
    };
    jotaiStore.set(updateAvailableAtom, updateInfo);

    if (!silent) {
      showToast({
        id: "github-update-available",
        color: "info",
        timeout: null,
        message: (
          <VStack>
            <h2 className="font-semibold">发现新版本 {latestVersion}</h2>
            <p className="text-text-subtle text-sm">
              当前版本 {currentVersion}，可以直接打开下载链接更新。
            </p>
          </VStack>
        ),
        action: () => (
          <HStack space={1.5}>
            <Button
              size="xs"
              color="info"
              className="min-w-[6rem]"
              onClick={() => openUrl(updateInfo.downloadUrl ?? updateInfo.releaseUrl ?? RELEASE_PAGE_URL)}
            >
              立即下载
            </Button>
            <Button
              size="xs"
              color="info"
              variant="border"
              onClick={() => openUrl(updateInfo.releaseUrl ?? RELEASE_PAGE_URL)}
            >
              查看发布页
            </Button>
          </HStack>
        ),
      });
    }
  } catch (err) {
    if (!silent) {
      showAlert({
        id: "check-updates-error",
        title: "检查更新失败",
        body: `${err instanceof Error ? err.message : String(err)}`,
      });
    }
  }
}

async function fetchLatestRelease(): Promise<GitHubRelease> {
  const response = await fetch(RELEASE_API_URL, {
    headers: {
      Accept: "application/vnd.github+json",
    },
  });

  if (!response.ok) {
    throw new Error(`GitHub Releases 请求失败：${response.status}`);
  }

  return response.json() as Promise<GitHubRelease>;
}

function extractReleaseVersion(release: GitHubRelease): string {
  const text = `${release.name}\n${release.body}\n${release.tag_name}`;
  const matched = text.match(/(\d+\.\d+\.\d+)/);
  if (matched?.[1]) {
    return matched[1];
  }
  return normalizeVersion(release.tag_name);
}

function normalizeVersion(version: string): string {
  return version.trim().replace(/^[^\d]*/, "");
}

function compareVersions(a: string, b: string): number {
  const aParts = a.split(".").map((v) => Number.parseInt(v, 10) || 0);
  const bParts = b.split(".").map((v) => Number.parseInt(v, 10) || 0);
  const length = Math.max(aParts.length, bParts.length);

  for (let i = 0; i < length; i += 1) {
    const left = aParts[i] ?? 0;
    const right = bParts[i] ?? 0;
    if (left > right) return 1;
    if (left < right) return -1;
  }

  return 0;
}

function pickDownloadUrl(release: GitHubRelease): string {
  const osType = type();
  const osArch = arch();
  const assets = release.assets ?? [];

  const candidates = assets.filter((asset) => {
    const name = asset.name.toLowerCase();
    if (osType === "macos") {
      return name.endsWith(".dmg");
    }
    if (osType === "windows") {
      return name.endsWith(".exe");
    }
    return false;
  });

  const preferred =
    candidates.find((asset) => assetMatchesArch(asset.name, osType, osArch)) ??
    candidates[0] ??
    assets[0];

  return preferred?.browser_download_url ?? release.html_url ?? RELEASE_PAGE_URL;
}

function assetMatchesArch(name: string, osType: string, osArch: string): boolean {
  const lower = name.toLowerCase();
  if (osType === "macos") {
    if (osArch === "aarch64" || osArch === "arm64") {
      return lower.includes("arm64") || lower.includes("aarch64");
    }
    return lower.includes("x64") || lower.includes("x86_64");
  }

  if (osType === "windows") {
    if (osArch === "aarch64" || osArch === "arm64") {
      return lower.includes("arm64") || lower.includes("aarch64");
    }
    return lower.includes("x64") || lower.includes("x86_64");
  }

  return false;
}

function shouldAutoCheckNow(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  const lastChecked = Number.parseInt(
    window.localStorage.getItem(AUTO_CHECK_STORAGE_KEY) ?? "0",
    10,
  );
  if (!Number.isFinite(lastChecked) || lastChecked <= 0) {
    return true;
  }

  return Date.now() - lastChecked >= AUTO_CHECK_INTERVAL_MS;
}

function markAutoChecked() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(AUTO_CHECK_STORAGE_KEY, `${Date.now()}`);
}
