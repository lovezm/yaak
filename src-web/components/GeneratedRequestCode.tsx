import { getModel } from "@yaakapp-internal/models";
import type { HttpRequest, HttpResponse, HttpResponseEvent } from "@yaakapp-internal/models";
import { useMemo } from "react";
import { useHttpRequestBody } from "../hooks/useHttpRequestBody";
import { useKeyValue } from "../hooks/useKeyValue";
import { getMimeTypeFromContentType, isProbablyTextContentType } from "../lib/contentType";
import { t } from "../lib/i18n";
import { Banner } from "./core/Banner";
import { Editor } from "./core/Editor/LazyEditor";
import { LoadingIcon } from "./core/LoadingIcon";
import { SegmentedControl } from "./core/SegmentedControl";
import { HStack, VStack } from "./core/Stacks";
import { EmptyStateText } from "./EmptyStateText";
import { CopyIconButton } from "./CopyIconButton";

export type GeneratedRequestCodeMode = "curl" | "python" | "e";

interface Props {
  response: HttpResponse;
  events: HttpResponseEvent[] | undefined;
}

const DEFAULT_MODE: GeneratedRequestCodeMode = "curl";
const MAX_INLINE_BODY_BYTES = 64 * 1024;

export function GeneratedRequestCode({ response, events }: Props) {
  const { data: requestBody, isLoading, error } = useHttpRequestBody(response);
  const { value: mode, set: setMode } = useKeyValue<GeneratedRequestCodeMode>({
    namespace: "no_sync",
    key: "response_generated_code_mode",
    fallback: DEFAULT_MODE,
  });

  const activeMode = mode ?? DEFAULT_MODE;
  const request = getModel("http_request", response.requestId) as HttpRequest | null;

  const requestInfo = useMemo(() => {
    return getRequestInfo(response, request, events);
  }, [events, request, response]);

  const generated = useMemo(() => {
    const contentType =
      response.requestHeaders.find((h) => h.name.toLowerCase() === "content-type")?.value ?? null;
    const omittedReason = getBodyOmittedReason({
      contentType,
      contentLength: response.requestContentLength ?? 0,
      bodyText: requestBody?.bodyText ?? null,
    });

    return buildGeneratedSnippet({
      mode: activeMode,
      method: requestInfo.method,
      url: requestInfo.url,
      headers: response.requestHeaders,
      bodyText: omittedReason == null ? requestBody?.bodyText ?? null : null,
      omittedReason,
    });
  }, [activeMode, requestBody?.bodyText, requestInfo.method, requestInfo.url, response]);

  if (isLoading && (response.requestContentLength ?? 0) > 0) {
    return (
      <EmptyStateText>
        <HStack space={2}>
          <LoadingIcon className="text-text-subtlest" />
          {t("Generating code...")}
        </HStack>
      </EmptyStateText>
    );
  }

  return (
    <VStack className="h-full min-h-0" space={2}>
      <HStack justifyContent="between" space={2} wrap>
        <SegmentedControl
          name={`generated-request-code.${response.id}`}
          label={t("Generated Code")}
          hideLabel
          value={activeMode}
          onChange={(nextMode) => {
            void setMode(nextMode);
          }}
          options={[
            { value: "curl", label: t("cURL") },
            { value: "python", label: t("Python httpx") },
            { value: "e", label: t("E Language") },
          ]}
        />
        <CopyIconButton
          text={generated.code}
          title={t("Copy generated code")}
          variant="border"
          size="sm"
          iconSize="sm"
        />
      </HStack>

      {generated.warning != null && <Banner color="warning">{generated.warning}</Banner>}
      {error != null && (
        <Banner color="danger">
          {t("Failed to load request body for code generation")}
          {`: ${error.message}`}
        </Banner>
      )}

      <div className="min-h-0 flex-1">
        <Editor
          hideGutter
          readOnly
          wrapLines
          defaultValue={generated.code}
          forceUpdateKey={generated.code}
          language={activeMode === "curl" ? "shell" : activeMode === "python" ? "python" : "text"}
          stateKey={`generated_request_code.${response.id}.${activeMode}`}
        />
      </div>
    </VStack>
  );
}

function getRequestInfo(
  response: HttpResponse,
  request: HttpRequest | null,
  events: HttpResponseEvent[] | undefined,
) {
  const sendUrlEvent = [...(events ?? [])]
    .reverse()
    .find((event) => event.event.type === "send_url")?.event;

  if (sendUrlEvent?.type === "send_url") {
    return {
      method: sendUrlEvent.method,
      url: buildUrlFromSendEvent(sendUrlEvent),
    };
  }

  return {
    method: request?.method ?? "GET",
    url: request?.url ?? response.url,
  };
}

function buildUrlFromSendEvent(event: Extract<HttpResponseEvent["event"], { type: "send_url" }>) {
  const auth = event.username || event.password ? `${event.username}:${event.password}@` : "";
  const isDefaultPort =
    (event.scheme === "http" && event.port === 80) || (event.scheme === "https" && event.port === 443);
  const port = isDefaultPort ? "" : `:${event.port}`;
  const query = event.query ? `?${event.query}` : "";
  const fragment = event.fragment ? `#${event.fragment}` : "";
  return `${event.scheme}://${auth}${event.host}${port}${event.path}${query}${fragment}`;
}

function getBodyOmittedReason({
  contentType,
  contentLength,
  bodyText,
}: {
  contentType: string | null;
  contentLength: number;
  bodyText: string | null;
}) {
  if (!bodyText) {
    return null;
  }

  if (contentLength > MAX_INLINE_BODY_BYTES) {
    return t("Request body omitted because it is too large to inline.");
  }

  if (contentType == null) {
    return null;
  }

  const mimeType = getMimeTypeFromContentType(contentType).essence.toLowerCase();
  if (mimeType.startsWith("multipart/")) {
    return t("Request body omitted because multipart data is not safe to inline.");
  }

  if (isProbablyTextContentType(contentType) || mimeType === "application/x-www-form-urlencoded") {
    return null;
  }

  return t("Request body omitted because it appears to be binary.");
}

function buildGeneratedSnippet({
  mode,
  method,
  url,
  headers,
  bodyText,
  omittedReason,
}: {
  mode: GeneratedRequestCodeMode;
  method: string;
  url: string;
  headers: Array<{ name: string; value: string }>;
  bodyText: string | null;
  omittedReason: string | null;
}) {
  if (mode === "e") {
    return {
      code: buildELanguageCode({ method, url, headers, bodyText, omittedReason }),
      warning: omittedReason,
    };
  }

  if (mode === "python") {
    return {
      code: buildHttpxCode({ method, url, headers, bodyText, omittedReason }),
      warning: omittedReason,
    };
  }

  return {
    code: buildCurlCode({ method, url, headers, bodyText, omittedReason }),
    warning: omittedReason,
  };
}

function buildCurlCode({
  method,
  url,
  headers,
  bodyText,
  omittedReason,
}: {
  method: string;
  url: string;
  headers: Array<{ name: string; value: string }>;
  bodyText: string | null;
  omittedReason: string | null;
}) {
  const args: string[] = [`curl --request ${method.toUpperCase()}`, `--url ${shellQuote(url)}`];

  headers.forEach((header) => {
    args.push(`--header ${shellQuote(`${header.name}: ${header.value}`)}`);
  });

  if (bodyText != null) {
    args.push(`--data-raw ${shellQuote(bodyText)}`);
  }

  const command = args
    .map((arg, index) => `${index === 0 ? arg : `  ${arg}`}${index < args.length - 1 ? " \\" : ""}`)
    .join("\n");

  if (omittedReason == null) {
    return command;
  }

  return `${command}\n\n# ${omittedReason}`;
}

function buildHttpxCode({
  method,
  url,
  headers,
  bodyText,
  omittedReason,
}: {
  method: string;
  url: string;
  headers: Array<{ name: string; value: string }>;
  bodyText: string | null;
  omittedReason: string | null;
}) {
  const lines = ["import httpx", "", `url = ${pythonString(url)}`];

  if (headers.length > 0) {
    lines.push("headers = {");
    headers.forEach((header) => {
      lines.push(`    ${pythonString(header.name)}: ${pythonString(header.value)},`);
    });
    lines.push("}");
  }

  if (bodyText != null) {
    lines.push(`content = ${pythonString(bodyText)}`);
  } else if (omittedReason != null) {
    lines.push(`# ${omittedReason}`);
  }

  lines.push("", "response = httpx.request(");
  lines.push(`    ${pythonString(method.toUpperCase())},`);
  lines.push("    url,");

  if (headers.length > 0) {
    lines.push("    headers=headers,");
  }

  if (bodyText != null) {
    lines.push("    content=content,");
  }

  lines.push(")", "", "print(response.status_code)", "print(response.text)");
  return lines.join("\n");
}

function buildELanguageCode({
  method,
  url,
  headers,
  bodyText,
  omittedReason,
}: {
  method: string;
  url: string;
  headers: Array<{ name: string; value: string }>;
  bodyText: string | null;
  omittedReason: string | null;
}) {
  const methodUpper = method.toUpperCase();
  const isGet = methodUpper === "GET";
  const isFormBody = isFormUrlencodedBody(headers, bodyText);
  const methodValue = isGet ? 0 : 1;
  const lines: string[] = [
    ".版本 2",
    "",
    ".子程序 功能_网页访问, 文本型, ,",
    ".局部变量  局_网址, 文本型",
    ".局部变量  局_方式, 整数型",
  ];

  if (isFormBody) {
    lines.push(".局部变量  ADD_数据包, 类_POST数据类");
  }

  lines.push(".局部变量  局_提交数据, 文本型");

  if (headers.length > 0) {
    lines.push(".局部变量  ADD_协议头, 类_POST数据类");
    lines.push(".局部变量  局_提交协议头, 文本型");
  }

  lines.push(".局部变量  局_结果, 字节集");
  lines.push(".局部变量  局_返回, 文本型");
  lines.push("");
  lines.push(`局_网址 = ${eStringLiteral(url)}`);
  lines.push(`局_方式 = ${methodValue}`);
  lines.push("");

  if (methodUpper !== "GET" && methodUpper !== "POST") {
    lines.push(`' 原请求方法为 ${methodUpper}，易语言模板默认按 POST 方式生成，请按需调整`);
    lines.push("");
  }

  if (!isGet && bodyText != null) {
    if (isFormBody) {
      const params = new URLSearchParams(bodyText);
      params.forEach((value, name) => {
        lines.push(`ADD_数据包.添加 (${eStringLiteral(name)}, ${eStringLiteral(value)})`);
      });
      lines.push("");
      lines.push("局_提交数据 = ADD_数据包.获取Post数据 ()");
    } else {
      lines.push(`局_提交数据 = ${eStringExpression(bodyText)}`);
    }
    lines.push("");
  } else if (!isGet) {
    lines.push('局_提交数据 = ""');
    lines.push("");
  }

  if (headers.length > 0) {
    headers.forEach((header) => {
      lines.push(`ADD_协议头.添加 (${eStringLiteral(header.name)}, ${eStringLiteral(header.value)})`);
    });
    lines.push("");
    lines.push("局_提交协议头 = ADD_协议头.获取协议头数据 ()");
    lines.push("");
  }

  lines.push(
    `局_结果 = 网页_访问_对象 (局_网址, 局_方式, ${isGet ? "" : "局_提交数据"}, , , ${headers.length > 0 ? "局_提交协议头" : ""}, , , , , , , , , , , )`,
  );
  lines.push("局_返回 = 到文本(编码_编码转换对象(局_结果))");
  lines.push("返回 (局_返回)");

  if (omittedReason != null) {
    lines.push("");
    lines.push(`' ${omittedReason}`);
  }

  return lines.join("\n");
}

function shellQuote(value: string) {
  return `'${value.replaceAll("'", `'\"'\"'`)}'`;
}

function pythonString(value: string) {
  return JSON.stringify(value);
}

function isFormUrlencodedBody(
  headers: Array<{ name: string; value: string }>,
  bodyText: string | null,
) {
  if (bodyText == null || bodyText.trim() === "") {
    return false;
  }

  const contentType =
    headers.find((header) => header.name.toLowerCase() === "content-type")?.value.toLowerCase() ?? "";
  if (!contentType.includes("application/x-www-form-urlencoded")) {
    return false;
  }

  try {
    const params = new URLSearchParams(bodyText);
    return Array.from(params.keys()).length > 0;
  } catch {
    return false;
  }
}

function eStringLiteral(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}

function eStringExpression(value: string) {
  const escaped = value
    .replaceAll("\r\n", "\n")
    .replaceAll("\r", "\n")
    .replaceAll('"', '"+#引号+"')
    .replaceAll("\n", '"+#换行符+"');
  return `"${escaped}"`;
}
