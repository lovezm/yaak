import { openUrl } from "@tauri-apps/plugin-opener";
import type { HttpResponse } from "@yaakapp-internal/models";
import { useMemo } from "react";
import { t } from "../lib/i18n";
import { CountBadge } from "./core/CountBadge";
import { DetailsBanner } from "./core/DetailsBanner";
import { IconButton } from "./core/IconButton";
import { KeyValueRow, KeyValueRows } from "./core/KeyValueRow";

interface Props {
  response: HttpResponse;
}

export function ResponseHeaders({ response }: Props) {
  const responseHeaders = useMemo(
    () =>
      [...response.headers].sort((a, b) =>
        a.name.toLocaleLowerCase().localeCompare(b.name.toLocaleLowerCase()),
      ),
    [response.headers],
  );
  const requestHeaders = useMemo(
    () =>
      [...response.requestHeaders].sort((a, b) =>
        a.name.toLocaleLowerCase().localeCompare(b.name.toLocaleLowerCase()),
      ),
    [response.requestHeaders],
  );
  const requestHeadersText = useMemo(() => headersToText(requestHeaders), [requestHeaders]);
  const responseHeadersText = useMemo(() => headersToText(responseHeaders), [responseHeaders]);
  return (
    <div className="overflow-auto h-full pb-4 gap-y-3 flex flex-col pr-0.5">
      <DetailsBanner storageKey={`${response.requestId}.general`} summary={<h2>{t("Info")}</h2>}>
        <KeyValueRows>
          <KeyValueRow labelColor="secondary" label={t("Request URL")}>
            <div className="flex items-center gap-1">
              <span className="select-text cursor-text">{response.url}</span>
              <IconButton
                iconSize="sm"
                className="inline-block w-auto !h-auto opacity-50 hover:opacity-100"
                icon="external_link"
                onClick={() => openUrl(response.url)}
                title={t("Open in browser")}
              />
            </div>
          </KeyValueRow>
          <KeyValueRow labelColor="secondary" label={t("Remote Address")}>
            {response.remoteAddr ?? <span className="text-text-subtlest">--</span>}
          </KeyValueRow>
          <KeyValueRow labelColor="secondary" label={t("Version")}>
            {response.version ?? <span className="text-text-subtlest">--</span>}
          </KeyValueRow>
        </KeyValueRows>
      </DetailsBanner>
      <DetailsBanner
        storageKey={`${response.requestId}.request_headers`}
        summary={
          <h2 className="flex items-center">
            {t("Request Headers")} <CountBadge showZero count={requestHeaders.length} />
          </h2>
        }
      >
        {requestHeaders.length === 0 ? (
          <NoHeaders />
        ) : (
          <HeadersTextBlock text={requestHeadersText} />
        )}
      </DetailsBanner>
      <DetailsBanner
        defaultOpen
        storageKey={`${response.requestId}.response_headers`}
        summary={
          <h2 className="flex items-center">
            {t("Response Headers")} <CountBadge showZero count={responseHeaders.length} />
          </h2>
        }
      >
        {responseHeaders.length === 0 ? (
          <NoHeaders />
        ) : (
          <HeadersTextBlock text={responseHeadersText} />
        )}
      </DetailsBanner>
    </div>
  );
}

function HeadersTextBlock({ text }: { text: string }) {
  return (
    <pre className="m-0 rounded-md border border-border-subtle px-3 py-2 font-mono text-sm leading-6 select-text cursor-text whitespace-pre-wrap break-all overflow-x-auto">
      {text}
    </pre>
  );
}

function NoHeaders() {
  return <span className="text-text-subtlest text-sm italic">{t("No Headers")}</span>;
}

function headersToText(headers: Array<{ name: string; value: string }>) {
  return headers.map((header) => `${header.name}:${header.value}`).join("\n");
}
