import type { HttpResponse } from "@yaakapp-internal/models";
import { getModel } from "@yaakapp-internal/models";
import type { ReactNode } from "react";
import { Fragment, lazy, Suspense, useMemo } from "react";
import { useHttpRequestBody } from "../hooks/useHttpRequestBody";
import { useKeyValue } from "../hooks/useKeyValue";
import { useResponseBodyText } from "../hooks/useResponseBodyText";
import { getMimeTypeFromContentType, isProbablyTextContentType, languageFromContentType } from "../lib/contentType";
import { t } from "../lib/i18n";
import { getContentTypeFromHeaders } from "../lib/model_util";
import { CopyIconButton } from "./CopyIconButton";
import { EmptyStateText } from "./EmptyStateText";
import { AudioViewer } from "./responseViewers/AudioViewer";
import { CsvViewer } from "./responseViewers/CsvViewer";
import { ImageViewer } from "./responseViewers/ImageViewer";
import { MultipartViewer } from "./responseViewers/MultipartViewer";
import { TextViewer } from "./responseViewers/TextViewer";
import { SvgViewer } from "./responseViewers/SvgViewer";
import { VideoViewer } from "./responseViewers/VideoViewer";
import { WebPageViewer } from "./responseViewers/WebPageViewer";
import { SegmentedControl } from "./core/SegmentedControl";
import { LoadingIcon } from "./core/LoadingIcon";
import { HStack, VStack } from "./core/Stacks";

const PdfViewer = lazy(() =>
  import("./responseViewers/PdfViewer").then((m) => ({ default: m.PdfViewer })),
);

type RequestPanelViewMode = "body" | "complete";

interface Props {
  response: HttpResponse;
}

export function RequestBodyViewer({ response }: Props) {
  return <RequestBodyViewerInner key={response.id} response={response} />;
}

function RequestBodyViewerInner({ response }: Props) {
  const { value: viewMode, set: setViewMode } = useKeyValue<RequestPanelViewMode>({
    namespace: "no_sync",
    key: "response_request_panel_mode",
    fallback: "body",
  });

  const activeMode = viewMode ?? "body";
  const requestBody = useHttpRequestBody(response);
  const responseBody = useResponseBodyText({
    response,
    filter: null,
    enabled: activeMode === "complete",
  });

  const completeText = useMemo(
    () =>
      buildCompleteExchangeText({
        response,
        requestBodyText: requestBody.data?.bodyText ?? "",
        requestBodyLoading: requestBody.isLoading,
        requestBodyError: requestBody.error?.message ?? null,
        responseBodyText: responseBody.data ?? "",
        responseBodyLoading: responseBody.isLoading,
        responseBodyError: responseBody.error?.message ?? null,
      }),
    [
      requestBody.data?.bodyText,
      requestBody.error?.message,
      requestBody.isLoading,
      response,
      responseBody.data,
      responseBody.error?.message,
      responseBody.isLoading,
    ],
  );

  return (
    <VStack className="h-full min-h-0" space={2}>
      <HStack justifyContent="between" space={2} wrap>
        <SegmentedControl
          name={`response-request-panel.${response.id}`}
          label={t("Request View")}
          hideLabel
          value={activeMode}
          onChange={(nextMode) => void setViewMode(nextMode)}
          options={[
            { value: "body", label: t("Request Data") },
            { value: "complete", label: t("Complete") },
          ]}
        />
        {activeMode === "complete" && (
          <CopyIconButton
            text={completeText}
            title={t("Copy complete message")}
            variant="border"
            size="sm"
            iconSize="sm"
          />
        )}
      </HStack>

      <div className="min-h-0 flex-1">
        {activeMode === "complete" ? (
          <CompleteExchangeViewer text={completeText} responseId={response.id} />
        ) : (
          <RequestBodyContent response={response} requestBody={requestBody} />
        )}
      </div>
    </VStack>
  );
}

function RequestBodyContent({
  response,
  requestBody,
}: {
  response: HttpResponse;
  requestBody: ReturnType<typeof useHttpRequestBody>;
}) {
  const { data, isLoading, error } = requestBody;

  if (isLoading) {
    return (
      <EmptyStateText>
        <LoadingIcon />
      </EmptyStateText>
    );
  }

  if (error) {
    return <EmptyStateText>{t("Error loading request body")}: {error.message}</EmptyStateText>;
  }

  if (data?.bodyText == null || data.bodyText.length === 0) {
    return <EmptyStateText>{t("No request body")}</EmptyStateText>;
  }

  const { bodyText, body } = data;

  const contentTypeHeader = response.requestHeaders.find(
    (h) => h.name.toLowerCase() === "content-type",
  );
  const contentType = contentTypeHeader?.value ?? null;
  const mimeType = contentType ? getMimeTypeFromContentType(contentType).essence : null;
  const language = languageFromContentType(contentType, bodyText);

  if (mimeType?.match(/^multipart/i)) {
    const boundary = contentType?.split("boundary=")[1] ?? "unknown";
    const bodyCopy = new Uint8Array(body);
    return (
      <MultipartViewer data={bodyCopy} boundary={boundary} idPrefix={`request.${response.id}`} />
    );
  }

  if (mimeType?.match(/^image\/svg/i)) {
    return <SvgViewer text={bodyText} />;
  }

  if (mimeType?.match(/^image/i)) {
    return <ImageViewer data={body.buffer} />;
  }

  if (mimeType?.match(/^audio/i)) {
    return <AudioViewer data={body} />;
  }

  if (mimeType?.match(/^video/i)) {
    return <VideoViewer data={body} />;
  }

  if (mimeType?.match(/csv|tab-separated/i)) {
    return <CsvViewer text={bodyText} />;
  }

  if (mimeType?.match(/^text\/html/i)) {
    return <WebPageViewer html={bodyText} />;
  }

  if (mimeType?.match(/pdf/i)) {
    return (
      <Suspense fallback={<LoadingIcon />}>
        <PdfViewer data={body} />
      </Suspense>
    );
  }

  return (
    <TextViewer text={bodyText} language={language} stateKey={`request.body.${response.id}`} />
  );
}

function buildCompleteExchangeText({
  response,
  requestBodyText,
  requestBodyLoading,
  requestBodyError,
  responseBodyText,
  responseBodyLoading,
  responseBodyError,
}: {
  response: HttpResponse;
  requestBodyText: string;
  requestBodyLoading: boolean;
  requestBodyError: string | null;
  responseBodyText: string;
  responseBodyLoading: boolean;
  responseBodyError: string | null;
}) {
  const request = getModel("http_request", response.requestId);
  const method = request?.method?.toUpperCase() ?? "GET";
  const httpVersion = normalizeHttpVersion(response.version);
  const requestLine = `${method} ${response.url} ${httpVersion}`;
  const responseLine = `${httpVersion} ${response.status}${response.statusReason ? ` ${response.statusReason}` : ""}`;

  const requestHeadersText = headersToText(response.requestHeaders);
  const responseHeadersText = headersToText(response.headers);
  const requestBody = resolveRequestBodyText({
    response,
    requestBodyText,
    requestBodyLoading,
    requestBodyError,
  });
  const responseBody = resolveResponseBodyText({
    response,
    responseBodyText,
    responseBodyLoading,
    responseBodyError,
  });

  return [
    requestLine,
    requestHeadersText,
    "",
    requestBody,
    "",
    responseLine,
    responseHeadersText,
    "",
    responseBody,
  ].join("\n");
}

function normalizeHttpVersion(version: string | null | undefined) {
  const trimmed = version?.trim();
  if (!trimmed) {
    return "HTTP/1.1";
  }

  return trimmed.toUpperCase().startsWith("HTTP/") ? trimmed : `HTTP/${trimmed}`;
}

function headersToText(headers: Array<{ name: string; value: string }>) {
  return headers.map((header) => `${header.name}: ${header.value}`).join("\n");
}

function resolveRequestBodyText({
  response,
  requestBodyText,
  requestBodyLoading,
  requestBodyError,
}: {
  response: HttpResponse;
  requestBodyText: string;
  requestBodyLoading: boolean;
  requestBodyError: string | null;
}) {
  if ((response.requestContentLength ?? 0) === 0) {
    return "";
  }

  if (requestBodyLoading) {
    return t("Loading request body...");
  }

  if (requestBodyError) {
    return `${t("Error loading request body")}: ${requestBodyError}`;
  }

  return requestBodyText;
}

function resolveResponseBodyText({
  response,
  responseBodyText,
  responseBodyLoading,
  responseBodyError,
}: {
  response: HttpResponse;
  responseBodyText: string;
  responseBodyLoading: boolean;
  responseBodyError: string | null;
}) {
  if ((response.contentLength ?? 0) === 0) {
    return "";
  }

  if (responseBodyLoading) {
    return t("Loading response body...");
  }

  if (responseBodyError) {
    return `${t("Error loading response body")}: ${responseBodyError}`;
  }

  const contentType = getContentTypeFromHeaders(response.headers);
  if (contentType != null && !isProbablyTextContentType(contentType)) {
    return t("Binary response body omitted");
  }

  return responseBodyText;
}

function CompleteExchangeViewer({ text, responseId }: { text: string; responseId: string }) {
  const sections = useMemo(() => parseExchangeSections(text), [text]);

  return (
    <div className="-mr-2 h-full overflow-auto rounded-md bg-surface px-0 py-2 font-mono text-sm select-text cursor-text [&_*]:select-text [&_*]:cursor-text">
      {sections.map((section, index) => (
        <div key={`${responseId}-${section.kind}-${index}`} className="flex">
          <span className="min-w-[2.5rem] !select-none !cursor-default pr-4 text-right text-text-subtlest opacity-45">
            {section.lineNumber}
          </span>
          <div className="min-w-0 flex-1 whitespace-pre-wrap break-words pr-4">
            {renderExchangeLine(section)}
          </div>
        </div>
      ))}
    </div>
  );
}

type ExchangeLine =
  | { kind: "requestLine"; lineNumber: number; line: string }
  | { kind: "responseLine"; lineNumber: number; line: string }
  | { kind: "requestHeader"; lineNumber: number; line: string }
  | { kind: "responseHeader"; lineNumber: number; line: string }
  | { kind: "requestBody"; lineNumber: number; line: string }
  | { kind: "requestBodyJson"; lineNumber: number; line: string }
  | { kind: "requestBodyHtml"; lineNumber: number; line: string }
  | { kind: "responseBody"; lineNumber: number; line: string }
  | { kind: "responseBodyJson"; lineNumber: number; line: string }
  | { kind: "responseBodyHtml"; lineNumber: number; line: string }
  | { kind: "blank"; lineNumber: number; line: string };

function parseExchangeSections(text: string): ExchangeLine[] {
  const lines = text.split("\n");
  const responseLineIndex = lines.findIndex((line, index) => index > 0 && /^HTTP\/\S+/i.test(line));
  const requestHeaderEnd = findBlankLine(lines, 1, responseLineIndex === -1 ? lines.length : responseLineIndex);
  const responseHeaderEnd =
    responseLineIndex === -1 ? -1 : findBlankLine(lines, responseLineIndex + 1, lines.length);
  const requestHeaders = lines.slice(1, requestHeaderEnd === -1 ? responseLineIndex === -1 ? lines.length : responseLineIndex : requestHeaderEnd);
  const responseHeaders =
    responseLineIndex === -1
      ? []
      : lines.slice(
          responseLineIndex + 1,
          responseHeaderEnd === -1 ? lines.length : responseHeaderEnd,
        );
  const requestBodyKind = resolveBodyKind("request", requestHeaders);
  const responseBodyKind = resolveBodyKind("response", responseHeaders);

  return lines.map((line, index) => {
    const lineNumber = index + 1;

    if (line === "") {
      return { kind: "blank", lineNumber, line } as ExchangeLine;
    }

    if (index === 0) {
      return { kind: "requestLine", lineNumber, line } as ExchangeLine;
    }

    if (responseLineIndex !== -1 && index === responseLineIndex) {
      return { kind: "responseLine", lineNumber, line } as ExchangeLine;
    }

    if (index < (requestHeaderEnd === -1 ? lines.length : requestHeaderEnd)) {
      return { kind: "requestHeader", lineNumber, line } as ExchangeLine;
    }

    if (responseLineIndex !== -1 && index > responseLineIndex && index < (responseHeaderEnd === -1 ? lines.length : responseHeaderEnd)) {
      return { kind: "responseHeader", lineNumber, line } as ExchangeLine;
    }

    if (responseLineIndex !== -1 && index > responseLineIndex) {
      return { kind: responseBodyKind, lineNumber, line } as ExchangeLine;
    }

    return { kind: requestBodyKind, lineNumber, line } as ExchangeLine;
  });
}

function findBlankLine(lines: string[], start: number, end: number) {
  for (let i = start; i < end; i++) {
    if (lines[i] === "") {
      return i;
    }
  }
  return -1;
}

function renderExchangeLine(section: ExchangeLine): ReactNode {
  if (section.kind === "blank") {
    return <span>&nbsp;</span>;
  }

  if (section.kind === "requestLine") {
    return renderStartLine(section.line, "request");
  }

  if (section.kind === "responseLine") {
    return renderStartLine(section.line, "response");
  }

  if (section.kind === "requestHeader") {
    return renderHeaderLine(section.line, "request");
  }

  if (section.kind === "responseHeader") {
    return renderHeaderLine(section.line, "response");
  }

  if (section.kind === "requestBodyJson" || section.kind === "responseBodyJson") {
    return renderJsonLine(section.line, section.kind === "requestBodyJson" ? "request" : "response");
  }

  if (section.kind === "requestBodyHtml" || section.kind === "responseBodyHtml") {
    return renderHtmlLine(section.line, section.kind === "requestBodyHtml" ? "request" : "response");
  }

  return (
    <span className={section.kind === "requestBody" ? "text-notice" : "text-text"}>
      {section.line}
    </span>
  );
}

function renderStartLine(line: string, type: "request" | "response") {
  if (type === "request") {
    const match = line.match(/^(\S+)\s+(\S+)\s+(HTTP\/\S+)$/i);
    if (match) {
      return (
        <>
          <span className="text-danger">{match[1]}</span>{" "}
          <span className="text-warning underline decoration-border-subtle underline-offset-2">
            {match[2]}
          </span>{" "}
          <span className="text-danger">{match[3]}</span>
        </>
      );
    }
  } else {
    const match = line.match(/^(HTTP\/\S+)\s+(\d+)(?:\s+(.*))?$/i);
    if (match) {
      return (
        <>
          <span className="text-danger">{match[1]}</span>{" "}
          <span className="text-success">{match[2]}</span>
          {match[3] ? (
            <>
              {" "}
              <span className="text-success">{match[3]}</span>
            </>
          ) : null}
        </>
      );
    }
  }

  return <span className="text-text">{line}</span>;
}

function renderHeaderLine(line: string, type: "request" | "response") {
  const separatorIndex = line.indexOf(":");
  if (separatorIndex === -1) {
    return <span className="text-text">{line}</span>;
  }

  const name = line.slice(0, separatorIndex);
  const value = line.slice(separatorIndex + 1);
  const nameClassName = type === "request" ? "text-danger" : "text-primary";
  const valueClassName = type === "request" ? "text-warning" : "text-text-subtle";

  return (
    <>
      <span className={nameClassName}>{name}</span>
      <span className="text-text-subtle">:</span>
      <span className={valueClassName}>{value}</span>
    </>
  );
}

function resolveBodyKind(
  type: "request" | "response",
  headers: string[],
): Extract<
  ExchangeLine["kind"],
  "requestBody" | "requestBodyJson" | "requestBodyHtml" | "responseBody" | "responseBodyJson" | "responseBodyHtml"
> {
  const contentType = getHeaderValue(headers, "content-type");
  if (contentType && isJsonContentType(contentType)) {
    return type === "request" ? "requestBodyJson" : "responseBodyJson";
  }

  if (contentType && isHtmlContentType(contentType)) {
    return type === "request" ? "requestBodyHtml" : "responseBodyHtml";
  }

  return type === "request" ? "requestBody" : "responseBody";
}

function getHeaderValue(headers: string[], name: string) {
  const prefix = `${name.toLowerCase()}:`;
  const header = headers.find((line) => line.toLowerCase().startsWith(prefix));
  if (!header) {
    return null;
  }

  return header.slice(header.indexOf(":") + 1).trim();
}

function isJsonContentType(contentType: string) {
  const normalized = contentType.toLowerCase();
  return normalized.includes("/json") || normalized.includes("+json") || normalized.includes("json;");
}

function isHtmlContentType(contentType: string) {
  return contentType.toLowerCase().includes("text/html");
}

function renderJsonLine(line: string, type: "request" | "response") {
  const tokens: ReactNode[] = [];
  const pattern =
    /"(?:\\.|[^"\\])*"|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|\btrue\b|\bfalse\b|\bnull\b|[{}\[\],:]/g;
  let cursor = 0;
  let index = 0;

  for (const match of line.matchAll(pattern)) {
    const token = match[0];
    const start = match.index ?? 0;

    if (start > cursor) {
      tokens.push(
        <Fragment key={`json-raw-${index++}`}>
          {line.slice(cursor, start)}
        </Fragment>,
      );
    }

    let className = type === "request" ? "text-notice" : "text-text";
    if (token === "true" || token === "false" || token === "null") {
      className = "text-warning";
    } else if (/^-?\d/.test(token)) {
      className = "text-info";
    } else if (token.startsWith("\"")) {
      const nextNonSpace = line.slice(start + token.length).match(/^\s*(.)/)?.[1];
      className = nextNonSpace === ":" ? "text-primary" : "text-success";
    } else if (/^[{}\[\],:]$/.test(token)) {
      className = "text-text-subtle";
    }

    tokens.push(
      <span key={`json-token-${index++}`} className={className}>
        {token}
      </span>,
    );
    cursor = start + token.length;
  }

  if (cursor < line.length) {
    tokens.push(
      <Fragment key={`json-tail-${index++}`}>
        {line.slice(cursor)}
      </Fragment>,
    );
  }

  return <>{tokens}</>;
}

function renderHtmlLine(line: string, type: "request" | "response") {
  const tokens: ReactNode[] = [];
  const pattern = /(<!--.*?-->|<!DOCTYPE[^>]*>|<\/?[^>]+>)/gi;
  let cursor = 0;
  let index = 0;

  for (const match of line.matchAll(pattern)) {
    const token = match[0];
    const start = match.index ?? 0;

    if (start > cursor) {
      tokens.push(
        <span
          key={`html-text-${index++}`}
          className={type === "request" ? "text-notice" : "text-text"}
        >
          {line.slice(cursor, start)}
        </span>,
      );
    }

    tokens.push(
      <span key={`html-tag-${index++}`} className="text-primary">
        {token}
      </span>,
    );
    cursor = start + token.length;
  }

  if (cursor < line.length) {
    tokens.push(
      <span
        key={`html-tail-${index++}`}
        className={type === "request" ? "text-notice" : "text-text"}
      >
        {line.slice(cursor)}
      </span>,
    );
  }

  return <>{tokens}</>;
}
