import type { HttpRequest, HttpRequestHeader } from "@yaakapp-internal/models";
import { useQuery } from "@tanstack/react-query";
import type { CSSProperties, ReactNode } from "react";
import { Fragment, useMemo } from "react";
import { PrismLight as SyntaxHighlighter } from "react-syntax-highlighter";
import bash from "react-syntax-highlighter/dist/esm/languages/prism/bash";
import java from "react-syntax-highlighter/dist/esm/languages/prism/java";
import python from "react-syntax-highlighter/dist/esm/languages/prism/python";
import rust from "react-syntax-highlighter/dist/esm/languages/prism/rust";
import { useActiveEnvironment } from "../hooks/useActiveEnvironment";
import { useInheritedHeaders } from "../hooks/useInheritedHeaders";
import { useKeyValue } from "../hooks/useKeyValue";
import { renderTemplate } from "../hooks/useRenderTemplate";
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
import { SegmentedControl } from "./core/SegmentedControl";
import { HStack, VStack } from "./core/Stacks";
import { CopyIconButton } from "./CopyIconButton";

SyntaxHighlighter.registerLanguage("bash", bash);
SyntaxHighlighter.registerLanguage("python", python);
SyntaxHighlighter.registerLanguage("java", java);
SyntaxHighlighter.registerLanguage("rust", rust);

export type GeneratedRequestCodeMode = "curl" | "python" | "java" | "rust" | "e";

interface Props {
  request: HttpRequest | null;
}

const DEFAULT_MODE: GeneratedRequestCodeMode = "curl";
const MAX_INLINE_BODY_BYTES = 64 * 1024;

export function GeneratedRequestCode({ request }: Props) {
  const inheritedHeaders = useInheritedHeaders(request);
  const activeEnvironment = useActiveEnvironment();
  const { value: mode, set: setMode } = useKeyValue<GeneratedRequestCodeMode>({
    namespace: "no_sync",
    key: "response_generated_code_mode",
    fallback: DEFAULT_MODE,
  });

  const activeMode = mode ?? DEFAULT_MODE;

  const rawRequestSnapshot = useMemo(() => {
    return buildRequestSnapshot(request, inheritedHeaders);
  }, [inheritedHeaders, request]);

  const renderedSnapshot = useQuery({
    enabled: request != null,
    refetchOnWindowFocus: false,
    placeholderData: (prev) => prev,
    queryKey: [
      "generated_request_rendered_snapshot",
      request?.id ?? null,
      request?.updatedAt ?? null,
      request?.workspaceId ?? null,
      activeEnvironment?.id ?? null,
      rawRequestSnapshot.method,
      rawRequestSnapshot.url,
      rawRequestSnapshot.bodyText,
      rawRequestSnapshot.headers.map((header) => `${header.name}\u0000${header.value}`).join("\u0001"),
    ],
    queryFn: async () =>
      renderRequestSnapshotTemplates({
        snapshot: rawRequestSnapshot,
        workspaceId: request?.workspaceId ?? "n/a",
        environmentId: activeEnvironment?.id ?? null,
      }),
  });

  const requestSnapshot = renderedSnapshot.data ?? rawRequestSnapshot;

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
      noFollowRedirects: requestSnapshot.noFollowRedirects,
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
            { value: "python", label: t("Python") },
            { value: "java", label: t("Java") },
            { value: "rust", label: t("Rust") },
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

      <div className="min-h-0 flex-1 overflow-auto rounded-md border border-border-subtle bg-surface-highlight/30">
        {activeMode === "e" ? (
          <ELanguageCodeBlock code={generated.code} />
        ) : (
          <SyntaxHighlighter
            language={getGeneratedCodeLanguage(activeMode)}
            style={generatedCodeTheme}
            showLineNumbers
            customStyle={generatedCodeBlockStyle}
            codeTagProps={{ style: generatedCodeTagStyle }}
            lineNumberStyle={generatedCodeLineNumberStyle}
            wrapLongLines
          >
            {generated.code}
          </SyntaxHighlighter>
        )}
      </div>
    </VStack>
  );
}

async function renderRequestSnapshotTemplates({
  snapshot,
  workspaceId,
  environmentId,
}: {
  snapshot: ReturnType<typeof buildRequestSnapshot>;
  workspaceId: string;
  environmentId: string | null;
}) {
  const render = async (value: string | null) => {
    if (value == null || !containsTemplateSyntax(value)) {
      return value;
    }

    try {
      return await renderTemplate({
        template: value,
        workspaceId,
        environmentId,
        purpose: "send",
      });
    } catch {
      return value;
    }
  };

  const [url, bodyText, headers] = await Promise.all([
    render(snapshot.url),
    render(snapshot.bodyText),
    Promise.all(
      snapshot.headers.map(async (header) => ({
        name: (await render(header.name)) ?? header.name,
        value: (await render(header.value)) ?? header.value,
      })),
    ),
  ]);

  return {
    ...snapshot,
    url: url ?? snapshot.url,
    bodyText: bodyText ?? snapshot.bodyText,
    headers,
  };
}

function buildRequestSnapshot(request: HttpRequest | null, inheritedHeaders: HttpRequestHeader[]) {
  if (request == null) {
    return {
      method: "GET",
      url: "",
      headers: [] as Array<{ name: string; value: string }>,
      bodyText: null as string | null,
      omittedReason: null as string | null,
      noFollowRedirects: false,
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
    noFollowRedirects: request.noFollowRedirects ?? false,
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
  noFollowRedirects,
}: {
  mode: GeneratedRequestCodeMode;
  method: string;
  url: string;
  headers: Array<{ name: string; value: string }>;
  bodyText: string | null;
  omittedReason: string | null;
  noFollowRedirects: boolean;
}) {
  if (mode === "e") {
    return {
      code: buildELanguageCode({ method, url, headers, bodyText, omittedReason, noFollowRedirects }),
      warning: omittedReason,
    };
  }

  if (mode === "python") {
    return {
      code: buildHttpxCode({ method, url, headers, bodyText, omittedReason }),
      warning: omittedReason,
    };
  }

  if (mode === "java") {
    return {
      code: buildJavaCode({ method, url, headers, bodyText, omittedReason }),
      warning: omittedReason,
    };
  }

  if (mode === "rust") {
    return {
      code: buildRustCode({ method, url, headers, bodyText, omittedReason }),
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
  noFollowRedirects,
}: {
  method: string;
  url: string;
  headers: Array<{ name: string; value: string }>;
  bodyText: string | null;
  omittedReason: string | null;
  noFollowRedirects: boolean;
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
    `局_结果 = 网页_访问_对象 (局_网址, 局_方式, ${isGet ? "" : "局_提交数据"}, , , ${headers.length > 0 ? "局_提交协议头" : ""}, , , ${noFollowRedirects ? "真" : ""}, , , , , , , , )`,
  );
  lines.push("局_返回 = 到文本(编码_编码转换对象(局_结果))");
  lines.push("返回 (局_返回)");

  if (omittedReason != null) {
    lines.push("");
    lines.push(`' ${omittedReason}`);
  }

  return lines.join("\n");
}

function buildJavaCode({
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
  const lines = [
    "import java.io.IOException;",
    "import java.net.URI;",
    "import java.net.http.HttpClient;",
    "import java.net.http.HttpRequest;",
    "import java.net.http.HttpResponse;",
    "",
    "public class Main {",
    "    public static void main(String[] args) throws IOException, InterruptedException {",
    "        HttpClient client = HttpClient.newHttpClient();",
    "",
    "        HttpRequest.Builder requestBuilder = HttpRequest.newBuilder()",
    `            .uri(URI.create(${javaString(url)}))`,
  ];

  headers.forEach((header) => {
    lines.push(`            .header(${javaString(header.name)}, ${javaString(header.value)})`);
  });

  const bodyPublisher =
    bodyText != null
      ? `HttpRequest.BodyPublishers.ofString(${javaString(bodyText)})`
      : "HttpRequest.BodyPublishers.noBody()";

  lines.push(`            .method(${javaString(method.toUpperCase())}, ${bodyPublisher});`);
  if (omittedReason != null) {
    lines.push("");
    lines.push(`        // ${omittedReason}`);
  }
  lines.push("");
  lines.push("        HttpResponse<String> response = client.send(");
  lines.push("            requestBuilder.build(),");
  lines.push("            HttpResponse.BodyHandlers.ofString()");
  lines.push("        );");
  lines.push("");
  lines.push("        System.out.println(response.statusCode());");
  lines.push("        System.out.println(response.body());");
  lines.push("    }");
  lines.push("}");

  return lines.join("\n");
}

function buildRustCode({
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
  const lines = [
    '// Cargo.toml: reqwest = { version = "0.12", features = ["blocking"] }',
    "use reqwest::blocking::Client;",
    "use reqwest::Method;",
    "use std::error::Error;",
    "",
    "fn main() -> Result<(), Box<dyn Error>> {",
    "    let client = Client::new();",
    `    let mut request = client.request(Method::from_bytes(${rustString(method.toUpperCase())}.as_bytes())?, ${rustString(url)});`,
  ];

  headers.forEach((header) => {
    lines.push(`    request = request.header(${rustString(header.name)}, ${rustString(header.value)});`);
  });

  if (bodyText != null) {
    lines.push(`    request = request.body(${rustString(bodyText)});`);
  } else if (omittedReason != null) {
    lines.push(`    // ${omittedReason}`);
  }

  lines.push("");
  lines.push("    let response = request.send()?;");
  lines.push("    println!(\"{}\", response.status());");
  lines.push("    println!(\"{}\", response.text()?);");
  lines.push("    Ok(())");
  lines.push("}");

  return lines.join("\n");
}

function getGeneratedCodeLanguage(mode: GeneratedRequestCodeMode) {
  if (mode === "curl") return "bash";
  if (mode === "python") return "python";
  if (mode === "java") return "java";
  if (mode === "rust") return "rust";
  return "bash";
}

function shellQuote(value: string) {
  return `'${value.replaceAll("'", `'\"'\"'`)}'`;
}

function containsTemplateSyntax(value: string) {
  return value.includes("${[");
}

function pythonString(value: string) {
  return JSON.stringify(value);
}

function javaString(value: string) {
  return JSON.stringify(value);
}

function rustString(value: string) {
  return JSON.stringify(value);
}

const generatedCodeTheme = {
  'pre[class*="language-"]': {
    background: "transparent",
  },
  'code[class*="language-"]': {
    background: "transparent",
  },
  comment: { color: "var(--textSubtle)" },
  prolog: { color: "var(--textSubtle)" },
  doctype: { color: "var(--textSubtle)" },
  cdata: { color: "var(--textSubtle)" },
  punctuation: { color: "var(--textSubtle)" },
  property: { color: "var(--primary)" },
  "attr-name": { color: "var(--primary)" },
  string: { color: "var(--notice)" },
  char: { color: "var(--notice)" },
  number: { color: "var(--info)" },
  constant: { color: "var(--info)" },
  symbol: { color: "var(--info)" },
  boolean: { color: "var(--warning)" },
  "attr-value": { color: "var(--warning)" },
  variable: { color: "var(--success)" },
  tag: { color: "var(--info)" },
  operator: { color: "var(--danger)" },
  keyword: { color: "var(--danger)" },
  function: { color: "var(--success)" },
  "class-name": { color: "var(--primary)" },
  builtin: { color: "var(--danger)" },
  selector: { color: "var(--danger)" },
  inserted: { color: "var(--success)" },
  deleted: { color: "var(--danger)" },
  regex: { color: "var(--warning)" },
  important: { color: "var(--danger)", fontWeight: "bold" },
  italic: { fontStyle: "italic" },
  bold: { fontWeight: "bold" },
  entity: { cursor: "help" },
};

const generatedCodeBlockStyle: CSSProperties = {
  margin: 0,
  padding: "0.75rem 0",
  background: "transparent",
  minHeight: "100%",
  fontSize: "0.875rem",
};

const generatedCodeTagStyle: CSSProperties = {
  fontFamily: "var(--font-mono)",
};

const generatedCodeLineNumberStyle: CSSProperties = {
  minWidth: "2.5rem",
  paddingRight: "1rem",
  opacity: 0.45,
};

function ELanguageCodeBlock({ code }: { code: string }) {
  const lines = code.split("\n");

  return (
    <pre className="m-0 min-h-full bg-transparent py-3 text-sm">
      {lines.map((line, index) => (
        <div key={`${index}-${line}`} className="flex">
          <span className="select-none pr-4 text-right opacity-45" style={generatedCodeLineNumberStyle}>
            {index + 1}
          </span>
          <code style={generatedCodeTagStyle} className="flex-1 whitespace-pre-wrap break-words">
            {renderELanguageLine(line)}
          </code>
        </div>
      ))}
    </pre>
  );
}

function renderELanguageLine(line: string): ReactNode {
  const { codePart, commentPart } = splitELanguageComment(line);
  const nodes: ReactNode[] = [];
  const tokenRegex =
    /"(?:[^"]|"")*"|(^|\s)(\.[\u4e00-\u9fa5A-Za-z_][\u4e00-\u9fa5A-Za-z0-9_]*)|(^|\s)([\u4e00-\u9fa5A-Za-z_][\u4e00-\u9fa5A-Za-z0-9_]*)(\s*=)|([\u4e00-\u9fa5A-Za-z_][\u4e00-\u9fa5A-Za-z0-9_]*)(?=\s*\()/gmu;

  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = tokenRegex.exec(codePart)) !== null) {
    const matchText = match[0];
    const matchIndex = match.index;

    if (matchIndex > lastIndex) {
      nodes.push(
        <Fragment key={`plain-${lastIndex}`}>{codePart.slice(lastIndex, matchIndex)}</Fragment>,
      );
    }

    if (matchText.startsWith('"')) {
      nodes.push(
        <span key={`string-${matchIndex}`} className="text-notice">
          {matchText}
        </span>,
      );
    } else if (match[2]) {
      const leading = match[1] ?? "";
      nodes.push(<Fragment key={`kw-leading-${matchIndex}`}>{leading}</Fragment>);
      nodes.push(
        <span key={`kw-${matchIndex}`} className="text-danger">
          {match[2]}
        </span>,
      );
    } else if (match[4]) {
      const leading = match[3] ?? "";
      const variableName = match[4];
      const suffix = match[5] ?? "";
      nodes.push(<Fragment key={`var-leading-${matchIndex}`}>{leading}</Fragment>);
      nodes.push(
        <span key={`var-${matchIndex}`} className="text-info">
          {variableName}
        </span>,
      );
      nodes.push(<Fragment key={`var-suffix-${matchIndex}`}>{suffix}</Fragment>);
    } else if (match[6]) {
      nodes.push(
        <span key={`fn-${matchIndex}`} className="text-primary">
          {match[6]}
        </span>,
      );
    } else {
      nodes.push(<Fragment key={`raw-${matchIndex}`}>{matchText}</Fragment>);
    }

    lastIndex = matchIndex + matchText.length;
  }

  if (lastIndex < codePart.length) {
    nodes.push(<Fragment key={`tail-${lastIndex}`}>{codePart.slice(lastIndex)}</Fragment>);
  }

  if (commentPart != null) {
    nodes.push(
      <span key="comment" className="text-text-subtle">
        {commentPart}
      </span>,
    );
  }

  return nodes;
}

function splitELanguageComment(line: string) {
  let inString = false;

  for (let i = 0; i < line.length; i++) {
    const current = line[i];
    const next = line[i + 1];

    if (current === '"') {
      if (inString && next === '"') {
        i += 1;
        continue;
      }
      inString = !inString;
      continue;
    }

    if (!inString && current === "'") {
      return {
        codePart: line.slice(0, i),
        commentPart: line.slice(i),
      };
    }
  }

  return {
    codePart: line,
    commentPart: null as string | null,
  };
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
