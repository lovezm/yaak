import type { HttpRequest, HttpRequestHeader } from "@yaakapp-internal/models";
import { useMemo } from "react";
import { useInheritedHeaders } from "../hooks/useInheritedHeaders";
import { useKeyValue } from "../hooks/useKeyValue";
import { getMimeTypeFromContentType, isProbablyTextContentType } from "../lib/contentType";
import { t } from "../lib/i18n";
import {
  BODY_TYPE_BINARY,
  BODY_TYPE_FORM_MULTIPART,
  BODY_TYPE_FORM_URLENCODED,
  BODY_TYPE_GRAPHQL,
  getContentTypeFromHeaders,
} from "../lib/model_util";
import { Banner } from "./core/Banner";
import { Editor } from "./core/Editor/LazyEditor";
import { SegmentedControl } from "./core/SegmentedControl";
import { HStack, VStack } from "./core/Stacks";
import { CopyIconButton } from "./CopyIconButton";

export type GeneratedRequestCodeMode = "curl" | "python" | "e";

interface Props {
  request: HttpRequest | null;
}

const DEFAULT_MODE: GeneratedRequestCodeMode = "curl";
const MAX_INLINE_BODY_BYTES = 64 * 1024;

export function GeneratedRequestCode({ request }: Props) {
  const inheritedHeaders = useInheritedHeaders(request);
  const { value: mode, set: setMode } = useKeyValue<GeneratedRequestCodeMode>({
    namespace: "no_sync",
    key: "response_generated_code_mode",
    fallback: DEFAULT_MODE,
  });

  const activeMode = mode ?? DEFAULT_MODE;

  const requestSnapshot = useMemo(() => {
    return buildRequestSnapshot(request, inheritedHeaders);
  }, [inheritedHeaders, request]);

  const generated = useMemo(() => {
    const contentType = getContentTypeFromHeaders(requestSnapshot.headers);
    const omittedReason =
      requestSnapshot.omittedReason ??
      getBodyOmittedReason({
        contentType,
        contentLength: new TextEncoder().encode(requestSnapshot.bodyText ?? "").length,
        bodyText: requestSnapshot.bodyText,
      });

    return buildGeneratedSnippet({
      mode: activeMode,
      method: requestSnapshot.method,
      url: requestSnapshot.url,
      headers: requestSnapshot.headers,
      bodyText: omittedReason == null ? requestSnapshot.bodyText : null,
      omittedReason,
    });
  }, [activeMode, requestSnapshot]);

  return (
    <VStack className="h-full min-h-0" space={2}>
      <HStack justifyContent="between" space={2} wrap>
        <SegmentedControl
          name={`generated-request-code.${request?.id ?? "none"}`}
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

      <div className="min-h-0 flex-1">
        <Editor
          hideGutter
          readOnly
          wrapLines
          defaultValue={generated.code}
          forceUpdateKey={generated.code}
          language={activeMode === "curl" ? "shell" : activeMode === "python" ? "python" : "text"}
          stateKey={`generated_request_code.${request?.id ?? "none"}.${activeMode}`}
        />
      </div>
    </VStack>
  );
}

function buildRequestSnapshot(request: HttpRequest | null, inheritedHeaders: HttpRequestHeader[]) {
  if (request == null) {
    return {
      method: "GET",
      url: "",
      headers: [] as Array<{ name: string; value: string }>,
      bodyText: null as string | null,
      omittedReason: null as string | null,
    };
  }

  const headers = resolveHeaders(request, inheritedHeaders);
  const method = request.method ?? "GET";
  const { bodyText, omittedReason } = buildRequestBodyText(request, headers, method);
  const url = buildRequestUrl(request, method);

  return {
    method,
    url,
    headers,
    bodyText,
    omittedReason,
  };
}

function resolveHeaders(request: HttpRequest, inheritedHeaders: HttpRequestHeader[]) {
  const headersByName = new Map<string, HttpRequestHeader>();

  for (const header of [...inheritedHeaders, ...request.headers]) {
    headersByName.set(header.name.toLowerCase(), header);
  }

  return Array.from(headersByName.values())
    .filter((header) => header.enabled !== false && header.name.trim() !== "")
    .map((header) => ({ name: header.name, value: header.value ?? "" }));
}

function buildRequestUrl(request: HttpRequest, method: string) {
  if (request.bodyType !== BODY_TYPE_GRAPHQL || method.toUpperCase() !== "GET") {
    return request.url;
  }

  const { query, variables } = getGraphqlParts(request);
  try {
    const url = new URL(request.url, "http://yaak.local");

    url.searchParams.delete("query");
    url.searchParams.delete("variables");

    if (query.trim() !== "") {
      url.searchParams.set("query", query);
    }

    if (variables.trim() !== "") {
      url.searchParams.set("variables", variables);
    }

    return request.url.startsWith("http://") || request.url.startsWith("https://")
      ? `${url.origin}${url.pathname}${url.search}${url.hash}`
      : `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return request.url;
  }
}

function buildRequestBodyText(
  request: HttpRequest,
  headers: Array<{ name: string; value: string }>,
  method: string,
) {
  const methodUpper = method.toUpperCase();

  if (request.bodyType === BODY_TYPE_BINARY || request.bodyType === BODY_TYPE_FORM_MULTIPART) {
    return {
      bodyText: null,
      omittedReason:
        request.bodyType === BODY_TYPE_FORM_MULTIPART
          ? t("Request body omitted because multipart data is not safe to inline.")
          : t("Request body omitted because it appears to be binary."),
    };
  }

  if (request.bodyType === BODY_TYPE_FORM_URLENCODED) {
    return { bodyText: buildFormUrlencodedBody(request), omittedReason: null };
  }

  if (request.bodyType === BODY_TYPE_GRAPHQL) {
    const { query, variables } = getGraphqlParts(request);
    if (methodUpper === "GET") {
      return { bodyText: null, omittedReason: null };
    }

    return { bodyText: buildGraphqlBodyText(query, variables), omittedReason: null };
  }

  const contentType = getContentTypeFromHeaders(headers);
  const text = "text" in request.body ? request.body.text ?? "" : "";
  if (text === "") {
    return { bodyText: null, omittedReason: null };
  }

  if (contentType === "application/json" && request.body?.sendJsonComments !== true) {
    return { bodyText: text, omittedReason: null };
  }

  return { bodyText: text, omittedReason: null };
}

function buildFormUrlencodedBody(request: HttpRequest) {
  const formItems = Array.isArray(request.body?.form) ? request.body.form : [];
  const params = new URLSearchParams();
  for (const item of formItems) {
    if (item.enabled === false) continue;
    const name = item.name ?? "";
    if (name.trim() === "") continue;
    params.append(name, item.value ?? "");
  }

  const encoded = params.toString();
  return encoded === "" ? null : encoded;
}

function getGraphqlParts(request: HttpRequest) {
  if ("query" in request.body) {
    return {
      query: request.body.query ?? "",
      variables: request.body.variables ?? "",
    };
  }

  if ("text" in request.body) {
    try {
      const parsed = JSON.parse(request.body.text ?? "{}");
      return {
        query: typeof parsed.query === "string" ? parsed.query : "",
        variables:
          parsed.variables == null
            ? ""
            : typeof parsed.variables === "string"
              ? parsed.variables
              : JSON.stringify(parsed.variables),
      };
    } catch {
      return { query: "", variables: "" };
    }
  }

  return { query: "", variables: "" };
}

function buildGraphqlBodyText(query: string, variables: string) {
  if (variables.trim() === "") {
    return JSON.stringify({ query });
  }

  try {
    return JSON.stringify({ query, variables: JSON.parse(variables) });
  } catch {
    return `{"query":${JSON.stringify(query)},"variables":${variables}}`;
  }
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
