import type { HttpRequest } from "@yaakapp-internal/models";
import { patchModel } from "@yaakapp-internal/models";
import type { GenericCompletionOption } from "@yaakapp-internal/plugins";
import classNames from "classnames";
import { atom, useAtomValue } from "jotai";
import type { CSSProperties } from "react";
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { activeRequestIdAtom } from "../hooks/useActiveRequestId";
import { allRequestsAtom } from "../hooks/useAllRequests";
import { useAuthTab } from "../hooks/useAuthTab";
import { useCancelHttpResponse } from "../hooks/useCancelHttpResponse";
import { useHeadersTab } from "../hooks/useHeadersTab";
import { useImportCurl } from "../hooks/useImportCurl";
import { useInheritedHeaders } from "../hooks/useInheritedHeaders";
import { usePinnedHttpResponse } from "../hooks/usePinnedHttpResponse";
import { useRequestEditor, useRequestEditorEvent } from "../hooks/useRequestEditor";
import { useRequestUpdateKey } from "../hooks/useRequestUpdateKey";
import { useSendAnyHttpRequest } from "../hooks/useSendAnyHttpRequest";
import { deepEqualAtom } from "../lib/atoms";
import { buildUrlFromParameters } from "../lib/buildUrlFromParameters";
import { languageFromContentType } from "../lib/contentType";
import { generateId } from "../lib/generateId";
import {
  BODY_TYPE_BINARY,
  BODY_TYPE_FORM_MULTIPART,
  BODY_TYPE_FORM_URLENCODED,
  BODY_TYPE_GRAPHQL,
  BODY_TYPE_JSON,
  BODY_TYPE_NONE,
  BODY_TYPE_OTHER,
  BODY_TYPE_XML,
  getContentTypeFromHeaders,
} from "../lib/model_util";
import { prepareImportQuerystring } from "../lib/prepareImportQuerystring";
import { resolvedModelName } from "../lib/resolvedModelName";
import { showToast } from "../lib/toast";
import { t } from "../lib/i18n";
import { BinaryFileEditor } from "./BinaryFileEditor";
import { ConfirmLargeRequestBody } from "./ConfirmLargeRequestBody";
import { Button } from "./core/Button";
import { Checkbox } from "./core/Checkbox";
import { CountBadge } from "./core/CountBadge";
import type { GenericCompletionConfig } from "./core/Editor/genericCompletion";
import { Editor } from "./core/Editor/LazyEditor";
import { InlineCode } from "./core/InlineCode";
import type { Pair } from "./core/PairEditor";
import { PlainInput } from "./core/PlainInput";
import type { TabItem, TabsRef } from "./core/Tabs/Tabs";
import { setActiveTab, TabContent, Tabs } from "./core/Tabs/Tabs";
import { EmptyStateText } from "./EmptyStateText";
import { FormMultipartEditor } from "./FormMultipartEditor";
import { FormUrlencodedEditor } from "./FormUrlencodedEditor";
import { HeadersEditor } from "./HeadersEditor";
import { HttpAuthenticationEditor } from "./HttpAuthenticationEditor";
import { JsonBodyEditor } from "./JsonBodyEditor";
import { MarkdownEditor } from "./MarkdownEditor";
import { RequestMethodDropdown } from "./RequestMethodDropdown";
import { RequestCryptoPanel } from "./RequestCryptoPanel";
import { UrlBar } from "./UrlBar";
import { UrlParametersEditor } from "./UrlParameterEditor";

const GraphQLEditor = lazy(() =>
  import("./graphql/GraphQLEditor").then((m) => ({ default: m.GraphQLEditor })),
);

interface Props {
  style: CSSProperties;
  fullHeight: boolean;
  className?: string;
  activeRequest: HttpRequest;
}

const TAB_BODY = "body";
const TAB_PARAMS = "params";
const TAB_HEADERS = "headers";
const TAB_AUTH = "auth";
const TAB_DESCRIPTION = "description";
const TAB_PROXY = "proxy";
const TAB_REDIRECT = "redirect";
const TAB_CRYPTO = "crypto";
const TABS_STORAGE_KEY = "http_request_tabs";

const BODY_TYPE_TABS = [
  { label: "none", value: BODY_TYPE_NONE },
  { label: "form-data", value: BODY_TYPE_FORM_MULTIPART },
  { label: "x-www-form-urlencoded", value: BODY_TYPE_FORM_URLENCODED },
  { label: "JSON", value: BODY_TYPE_JSON },
  { label: "XML", value: BODY_TYPE_XML },
  { label: "Text", value: BODY_TYPE_OTHER },
  { label: "Binary", value: BODY_TYPE_BINARY },
  { label: "GraphQL", value: BODY_TYPE_GRAPHQL },
] as const;

const nonActiveRequestUrlsAtom = atom((get) => {
  const activeRequestId = get(activeRequestIdAtom);
  const requests = get(allRequestsAtom);
  return requests
    .filter((r) => r.id !== activeRequestId)
    .map((r): GenericCompletionOption => ({ type: "constant", label: r.url }));
});

const memoNotActiveRequestUrlsAtom = deepEqualAtom(nonActiveRequestUrlsAtom);

export function HttpRequestPane({ style, fullHeight, className, activeRequest }: Props) {
  const activeRequestId = activeRequest.id;
  const tabsRef = useRef<TabsRef>(null);
  const [localUrl, setLocalUrl] = useState(activeRequest.url);
  const [forceUpdateHeaderEditorKey, setForceUpdateHeaderEditorKey] = useState<number>(0);
  const forceUpdateKey = useRequestUpdateKey(activeRequest.id ?? null);
  const [{ urlKey }, { forceUrlRefresh, forceParamsRefresh }] = useRequestEditor();
  const contentType = getContentTypeFromHeaders(activeRequest.headers);
  const authTab = useAuthTab(TAB_AUTH, activeRequest);
  const headersTab = useHeadersTab(TAB_HEADERS, activeRequest);
  const inheritedHeaders = useInheritedHeaders(activeRequest);

  // Listen for event to focus the params tab (e.g., when clicking a :param in the URL)
  useRequestEditorEvent(
    "request_pane.focus_tab",
    () => {
      tabsRef.current?.setActiveTab(TAB_PARAMS);
    },
    [],
  );

  useEffect(() => {
    setLocalUrl(activeRequest.url);
  }, [activeRequest.url]);

  const handleContentTypeChange = useCallback(
    async (contentType: string | null, patch: Partial<Omit<HttpRequest, "headers">> = {}) => {
      if (activeRequest == null) {
        console.error("Failed to get active request to update", activeRequest);
        return;
      }

      const headers = activeRequest.headers.filter((h) => h.name.toLowerCase() !== "content-type");

      if (contentType != null) {
        headers.push({
          name: "Content-Type",
          value: contentType,
          enabled: true,
          id: generateId(),
        });
      }
      await patchModel(activeRequest, { ...patch, headers });

      // Force update header editor so any changed headers are reflected
      setTimeout(() => setForceUpdateHeaderEditorKey((u) => u + 1), 100);
    },
    [activeRequest],
  );

  const { urlParameterPairs, urlParametersKey } = useMemo(() => {
    const placeholderNames = Array.from(activeRequest.url.matchAll(/\/(:[^/]+)/g)).map(
      (m) => m[1] ?? "",
    );
    const nonEmptyParameters = activeRequest.urlParameters.filter((p) => p.name || p.value);
    const items: Pair[] = [...nonEmptyParameters];
    for (const name of placeholderNames) {
      const item = items.find((p) => p.name === name);
      if (item) {
        item.readOnlyName = true;
      } else {
        items.push({ name, value: "", enabled: true, readOnlyName: true, id: generateId() });
      }
    }
    return { urlParameterPairs: items, urlParametersKey: placeholderNames.join(",") };
  }, [activeRequest.url, activeRequest.urlParameters]);

  let numParams = 0;
  if (
    activeRequest.bodyType === BODY_TYPE_FORM_URLENCODED ||
    activeRequest.bodyType === BODY_TYPE_FORM_MULTIPART
  ) {
    numParams = Array.isArray(activeRequest.body?.form)
      ? activeRequest.body.form.filter((p) => p.name).length
      : 0;
  }

  const handleBodyTypeChange = useCallback(
    async (bodyType: string | null) => {
      if (bodyType === activeRequest.bodyType) return;

      const showMethodToast = (newMethod: string) => {
        if (activeRequest.method.toLowerCase() === newMethod.toLowerCase()) return;
        showToast({
          id: "switched-method",
          message: (
            <>
              Request method switched to <InlineCode>POST</InlineCode>
            </>
          ),
        });
      };

      const patch: Partial<HttpRequest> = { bodyType };
      let newContentType: string | null | undefined;
      if (bodyType === BODY_TYPE_NONE) {
        newContentType = null;
      } else if (
        bodyType === BODY_TYPE_FORM_URLENCODED ||
        bodyType === BODY_TYPE_FORM_MULTIPART ||
        bodyType === BODY_TYPE_JSON ||
        bodyType === BODY_TYPE_OTHER ||
        bodyType === BODY_TYPE_XML
      ) {
        const isDefaultishRequest =
          activeRequest.bodyType === BODY_TYPE_NONE && activeRequest.method.toLowerCase() === "get";
        const requiresPost = bodyType === BODY_TYPE_FORM_MULTIPART;
        if (isDefaultishRequest || requiresPost) {
          patch.method = "POST";
          showMethodToast(patch.method);
        }
        newContentType = bodyType === BODY_TYPE_OTHER ? "text/plain" : bodyType;
      } else if (bodyType === BODY_TYPE_GRAPHQL) {
        patch.method = "POST";
        newContentType = "application/json";
        showMethodToast(patch.method);
      }

      if (newContentType !== undefined) {
        await handleContentTypeChange(newContentType, patch);
      } else {
        await patchModel(activeRequest, patch);
      }
    },
    [activeRequest, handleContentTypeChange],
  );

  const tabs = useMemo<TabItem[]>(
    () => [
      {
        value: TAB_BODY,
        rightSlot: numParams > 0 ? <CountBadge count={numParams} /> : null,
        label: t("Body"),
      },
      {
        value: TAB_PARAMS,
        rightSlot: <CountBadge count={urlParameterPairs.length} />,
        label: t("Params"),
      },
      ...headersTab,
      ...authTab,
      {
        value: TAB_DESCRIPTION,
        label: t("Info"),
      },
      {
        value: TAB_PROXY,
        label: t("Proxy"),
      },
      {
        value: TAB_REDIRECT,
        label: t("Redirect"),
      },
      {
        value: TAB_CRYPTO,
        label: t("Crypto"),
      },
    ],
    [
      authTab,
      headersTab,
      numParams,
      urlParameterPairs.length,
    ],
  );

  const { mutate: sendRequest } = useSendAnyHttpRequest();
  const { activeResponse } = usePinnedHttpResponse(activeRequestId);
  const { mutate: cancelResponse } = useCancelHttpResponse(activeResponse?.id ?? null);
  const updateKey = useRequestUpdateKey(activeRequestId);
  const { mutate: importCurl } = useImportCurl();

  const handleBodyChange = useCallback(
    (body: HttpRequest["body"]) => patchModel(activeRequest, { body }),
    [activeRequest],
  );

  const handleBodyTextChange = useCallback(
    (text: string) => patchModel(activeRequest, { body: { ...activeRequest.body, text } }),
    [activeRequest],
  );

  const autocompleteUrls = useAtomValue(memoNotActiveRequestUrlsAtom);

  const autocomplete: GenericCompletionConfig = useMemo(
    () => ({
      minMatch: 3,
      options:
        autocompleteUrls.length > 0
          ? autocompleteUrls
          : [
              { label: "http://", type: "constant" },
              { label: "https://", type: "constant" },
            ],
    }),
    [autocompleteUrls],
  );

  const handlePaste = useCallback(
    async (e: ClipboardEvent, text: string) => {
      if (text.startsWith("curl ")) {
        importCurl({ overwriteRequestId: activeRequestId, command: text });
      } else {
        const patch = prepareImportQuerystring(text);
        if (patch != null) {
          e.preventDefault(); // Prevent input onChange

          setLocalUrl(patch.url);
          await patchModel(activeRequest, patch);
          await setActiveTab({
            storageKey: TABS_STORAGE_KEY,
            activeTabKey: activeRequestId,
            value: TAB_PARAMS,
          });

          // Wait for request to update, then refresh the UI
          // TODO: Somehow make this deterministic
          setTimeout(() => {
            forceUrlRefresh();
            forceParamsRefresh();
          }, 100);
        }
      }
    },
    [activeRequest, activeRequestId, forceParamsRefresh, forceUrlRefresh, importCurl],
  );
  const handleSend = useCallback(
    () => sendRequest(activeRequest.id ?? null),
    [activeRequest.id, sendRequest],
  );

  const handleUrlChange = useCallback(
    (url: string) => {
      setLocalUrl(url);
      return patchModel(activeRequest, { url });
    },
    [activeRequest],
  );

  const handleUrlParametersChange = useCallback(
    async (urlParameters: HttpRequest["urlParameters"]) => {
      const url = buildUrlFromParameters(localUrl, urlParameters);
      setLocalUrl(url);
      forceUrlRefresh();
      await patchModel(activeRequest, { url, urlParameters });
    },
    [activeRequest, forceUrlRefresh, localUrl],
  );

  return (
    <div
      style={style}
      className={classNames(className, "h-full grid grid-rows-[auto_minmax(0,1fr)] grid-cols-1")}
    >
      {activeRequest && (
        <>
          <UrlBar
            stateKey={`url.${activeRequest.id}`}
            key={forceUpdateKey + urlKey}
            url={localUrl}
            placeholder="https://example.com"
            onPasteOverwrite={handlePaste}
            autocomplete={autocomplete}
            onSend={handleSend}
            onCancel={cancelResponse}
            onUrlChange={handleUrlChange}
            leftSlot={
              <div className="py-0.5">
                <RequestMethodDropdown request={activeRequest} className="ml-0.5 !h-full" />
              </div>
            }
            forceUpdateKey={updateKey}
            isLoading={activeResponse != null && activeResponse.state !== "closed"}
          />
          <Tabs
            ref={tabsRef}
            label="Request"
            tabs={tabs}
            tabListClassName="mt-1 -mb-1.5"
            storageKey={TABS_STORAGE_KEY}
            activeTabKey={activeRequestId}
          >
            <TabContent value={TAB_AUTH}>
              <HttpAuthenticationEditor model={activeRequest} />
            </TabContent>
            <TabContent value={TAB_HEADERS}>
              <HeadersEditor
                inheritedHeaders={inheritedHeaders}
                forceUpdateKey={`${forceUpdateHeaderEditorKey}::${forceUpdateKey}`}
                headers={activeRequest.headers}
                stateKey={`headers.${activeRequest.id}`}
                onChange={(headers) => patchModel(activeRequest, { headers })}
              />
            </TabContent>
            <TabContent value={TAB_PARAMS}>
              <UrlParametersEditor
                stateKey={`params.${activeRequest.id}`}
                forceUpdateKey={forceUpdateKey + urlParametersKey}
                pairs={urlParameterPairs}
                onChange={handleUrlParametersChange}
              />
            </TabContent>
            <TabContent value={TAB_BODY}>
              <div className="grid grid-rows-[auto_minmax(0,1fr)] h-full gap-3">
                <div className="rounded-md border border-border-subtle bg-surface p-2">
                  <div className="flex flex-wrap gap-2">
                    {BODY_TYPE_TABS.map((option) => {
                      const isActive = activeRequest.bodyType === option.value;
                      return (
                        <Button
                          key={option.value}
                          size="sm"
                          variant={isActive ? "solid" : "border"}
                          color={isActive ? "secondary" : undefined}
                          className={isActive ? "!text-text" : undefined}
                          onClick={() => void handleBodyTypeChange(option.value)}
                        >
                          {option.label}
                        </Button>
                      );
                    })}
                  </div>
                </div>
                <ConfirmLargeRequestBody request={activeRequest}>
                  {activeRequest.bodyType === BODY_TYPE_JSON ? (
                    <JsonBodyEditor
                      forceUpdateKey={forceUpdateKey}
                      heightMode={fullHeight ? "full" : "auto"}
                      request={activeRequest}
                    />
                  ) : activeRequest.bodyType === BODY_TYPE_XML ? (
                    <Editor
                      forceUpdateKey={forceUpdateKey}
                      autocompleteFunctions
                      autocompleteVariables
                      placeholder="..."
                      heightMode={fullHeight ? "full" : "auto"}
                      defaultValue={`${activeRequest.body?.text ?? ""}`}
                      language="xml"
                      onChange={handleBodyTextChange}
                      stateKey={`xml.${activeRequest.id}`}
                    />
                  ) : activeRequest.bodyType === BODY_TYPE_GRAPHQL ? (
                    <Suspense>
                      <GraphQLEditor
                        forceUpdateKey={forceUpdateKey}
                        baseRequest={activeRequest}
                        request={activeRequest}
                        onChange={handleBodyChange}
                      />
                    </Suspense>
                  ) : activeRequest.bodyType === BODY_TYPE_FORM_URLENCODED ? (
                    <FormUrlencodedEditor
                      forceUpdateKey={forceUpdateKey}
                      request={activeRequest}
                      onChange={handleBodyChange}
                    />
                  ) : activeRequest.bodyType === BODY_TYPE_FORM_MULTIPART ? (
                    <FormMultipartEditor
                      forceUpdateKey={forceUpdateKey}
                      request={activeRequest}
                      onChange={handleBodyChange}
                    />
                  ) : activeRequest.bodyType === BODY_TYPE_BINARY ? (
                    <BinaryFileEditor
                      requestId={activeRequest.id}
                      contentType={contentType}
                      body={activeRequest.body}
                      onChange={(body) => patchModel(activeRequest, { body })}
                      onChangeContentType={handleContentTypeChange}
                    />
                  ) : typeof activeRequest.bodyType === "string" ? (
                    <Editor
                      forceUpdateKey={forceUpdateKey}
                      autocompleteFunctions
                      autocompleteVariables
                      language={languageFromContentType(contentType)}
                      placeholder="..."
                      heightMode={fullHeight ? "full" : "auto"}
                      defaultValue={`${activeRequest.body?.text ?? ""}`}
                      onChange={handleBodyTextChange}
                      stateKey={`other.${activeRequest.id}`}
                    />
                  ) : (
                    <EmptyStateText>No Body</EmptyStateText>
                  )}
                </ConfirmLargeRequestBody>
              </div>
            </TabContent>
            <TabContent value={TAB_DESCRIPTION}>
              <div className="grid grid-rows-[auto_minmax(0,1fr)] h-full">
                <PlainInput
                  label="Request Name"
                  hideLabel
                  forceUpdateKey={updateKey}
                  defaultValue={activeRequest.name}
                  className="font-sans !text-xl !px-0"
                  containerClassName="border-0"
                  placeholder={resolvedModelName(activeRequest)}
                  onChange={(name) => patchModel(activeRequest, { name })}
                />
                <MarkdownEditor
                  name="request-description"
                  placeholder="Request description"
                  defaultValue={activeRequest.description}
                  stateKey={`description.${activeRequest.id}`}
                  forceUpdateKey={updateKey}
                  onChange={(description) => patchModel(activeRequest, { description })}
                />
              </div>
            </TabContent>
            <TabContent value={TAB_PROXY}>
              <div className="grid grid-rows-[auto_auto] gap-3 h-full content-start">
                <PlainInput
                  label={t("Proxy")}
                  forceUpdateKey={forceUpdateKey}
                  defaultValue={activeRequest.proxy ?? ""}
                  placeholder="user:pass@127.0.0.1:8080"
                  help={t(
                    "Supports IP:PORT, user:pass@IP:PORT, or user:pass:IP:PORT. If the value starts with http or https, it will be treated as a proxy API URL and fetched before the request is sent. Filled values only apply to this request.",
                  )}
                  onChange={(proxy) =>
                    patchModel(activeRequest, { proxy: proxy.trim() === "" ? null : proxy.trim() })
                  }
                />
                <div className="rounded-md border border-dashed border-border-subtle px-3 py-2 text-sm text-text-subtle">
                  <div>{t("Available formats:")}</div>
                  <div className="font-mono mt-1">127.0.0.1:8080</div>
                  <div className="font-mono">user:pass@127.0.0.1:8080</div>
                  <div className="font-mono">user:pass:127.0.0.1:8080</div>
                  <div className="font-mono">http://proxy-api.example.com/getips?num=1</div>
                </div>
              </div>
            </TabContent>
            <TabContent value={TAB_REDIRECT}>
              <div className="grid grid-rows-[auto] gap-3 h-full content-start">
                <div className="rounded-md border border-border-subtle px-3 py-2">
                  <Checkbox
                    checked={activeRequest.noFollowRedirects}
                    title={t("Disable redirects")}
                    help={t(
                      "When enabled, this request will stop on 3xx responses instead of automatically following redirects. If disabled, it will continue using the workspace redirect setting.",
                    )}
                    onChange={(noFollowRedirects) =>
                      patchModel(activeRequest, { noFollowRedirects })
                    }
                  />
                </div>
              </div>
            </TabContent>
            <TabContent value={TAB_CRYPTO}>
              <RequestCryptoPanel />
            </TabContent>
          </Tabs>
        </>
      )}
    </div>
  );
}
